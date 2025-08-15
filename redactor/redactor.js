/*
    Redactor
    Version 4.4.6
    Updated: July 28, 2025

    http://imperavi.com/redactor/

    Copyright (c) 2009-2025, Imperavi Ltd.
    License: http://imperavi.com/redactor/license/
*/
//@ts-nocheck
if (typeof CodeMirror === 'undefined') { var CodeMirror; }
(function() {
const DomCache = [{}];
const DomExpando = `data${Date.now()}`;
const DomVersion30 = '26.03.2025';

class Dom {
    constructor(s) {
        if (!s) {
            this.nodes = [];
        } else if (s instanceof Dom) {
            this.nodes = s.nodes;
        } else if (typeof s === 'string' && /^\s*<(\w+|!)[^>]*>/.test(s)) {
            this.nodes = this.create(s);
        } else if (s instanceof NodeList || Array.isArray(s)) {
            this.nodes = Array.from(s);
        } else if (s.nodeType && s.nodeType === 11) {
            this.nodes = Array.from(s.childNodes);
        } else if (s.nodeType || this._isWindowNode(s)) {
            this.nodes = [s];
        } else {
            this.nodes = this._slice(this._query(s));
        }
    }

    get length() {
        return this.nodes.length;
    }

    create(html) {
        const singleTagMatch = /^<(\w+)\s*\/?>(?:<\/\1>|)$/.exec(html);
        if (singleTagMatch) {
            return [document.createElement(singleTagMatch[1])];
        }

        const container = document.createElement('div');
        container.innerHTML = html;

        return Array.from(container.childNodes);
    }

    // dataset/dataget
    dataset(key, value) {
        return this.each($node => {
            const el = $node.get();
            if (el) {
                const index = this.dataindex(el);
                DomCache[index][key] = value;
            }
        });
    }

    dataget(key) {
        const el = this.get();
        if (el) {
            const index = this.dataindex(el);
            return DomCache[index][key];
        }
    }

    dataindex(el) {
        if (!el) return null;

        let index = el[DomExpando];
        if (!index) {
            index = DomCache.length;
            el[DomExpando] = index;
            DomCache[index] = {};
        }

        return index;
    }

    // add

    add(...nodes) {
        nodes.forEach(node => {
            if (typeof node === 'string') {
                node = new Dom(node).nodes;
            }
            this.nodes = [...this.nodes, ...this._array(node)];
        });
        return this;
    }

    // get

    get(index = 0) {
        return this.nodes[index] || null;
    }

    all() {
        return this.nodes;
    }

    getAll() { // @deprecated 5.0
        return this.all();
    }

    eq(index) {
        return new Dom(this.nodes[index] || null);
    }

    first() {
        return new Dom(this.nodes[0] || null);
    }

    last() {
        return new Dom(this.nodes[this.nodes.length - 1] || null);
    }

    contents() {
        return this.get()?.childNodes || [];
    }

    // loop

    each(fn) {
        this.nodes.forEach(($n, i) => fn(new Dom($n), i));
        return this;
    }

    map(fn) {
        return this.nodes.map(($n, i) => fn(new Dom($n), i));
    }

    some(fn) {
        return this.nodes.some(($n, i) => fn(new Dom($n), i));
    }

    // traversing

    is(s) {
        return this.filter(s).length > 0;
    }

    filter(s) {
        if (s === undefined) {
            return new Dom(this.nodes);
        }

        const fn = typeof s === 'function'
            ? node => s(new Dom(node))
            : node => {
                s = s instanceof Dom ? s.get() : s;
                if (s instanceof Node) return s === node;
                if (typeof s !== 'string') return false;
                return node.nodeType === 1 && node.matches(s || '*');
            };

        return new Dom(this.nodes.filter(fn));
    }

    not(filter) {
        return this.filter(node => !new Dom(node).is(filter || true));
    }

    find(s) {
        const n = [];
        this.each($n => {
            n.push(...this._query(s, $n.get()));
        });
        return new Dom(n);
    }

    children(s) {
        const n = [];
        this.each($n => {
            n.push(...($n.get().children || []));
        });
        return new Dom(n).filter(s);
    }

    parent(s) {
        const node = this.get();
        const p = node ? node.parentNode : null;
        return p ? new Dom(p).filter(s) : new Dom();
    }

    parents(s, c) {
        c = this._context(c);
        const n = [];
        this.each($n => {
            let p = $n.get().parentNode;
            while (p && p !== c) {
                if (!s || new Dom(p).is(s)) n.push(p);
                p = p.parentNode;
            }
        });
        return new Dom(n);
    }

    closest(s, c) {
        c = this._context(c);
        s = s instanceof Dom ? s.get() : s;

        const n = [];
        this.each($n => {
            let node = $n.get();
            while (node && node !== c) {
                if (s instanceof Node ? node === s : new Dom(node).is(s)) {
                    n.push(node);
                    break;
                }
                node = node.parentNode;
            }
        });
        return new Dom(n);
    }

    next(s) {
        return this._sibling(s, 'nextSibling');
    }

    nextElement(s) {
        return this._sibling(s, 'nextElementSibling');
    }

    prev(s) {
        return this._sibling(s, 'previousSibling');
    }

    prevElement(s) {
        return this._sibling(s, 'previousElementSibling');
    }

    // class

    addClass(value) {
        return this._eachClass(value, 'add');
    }

    removeClass(value) {
        return this._eachClass(value, 'remove');
    }

    toggleClass(value, force) {
        return this.each($n => {
            const node = $n.get();
            if (!node || !node.classList) return;

            value.split(' ').forEach(cls => {
                if (force !== undefined) {
                    node.classList.toggle(cls, force);
                } else {
                    node.classList.toggle(cls);
                }
            });
        });
    }

    hasClass(value) {
        const node = this.get();
        if (!value || !node || !node.classList) return false;
        return value.split(' ').every(cls => node.classList.contains(cls));
    }

    swapClass(from, to) {
        return this._eachClass(from, 'remove')._eachClass(to, 'add');
    }

    // css
    css(name, value) {
        if (value === undefined && typeof name !== 'object') {
            const node = this.get();
            if (!node || !node.style) return undefined;

            if (name === 'width' || name === 'height') {
                return this._getDimensions(name) + 'px';
            }

            return getComputedStyle(node)[name];
        }

        // set
        const styles = typeof name === 'object' ? name : { [name]: value };
        return this.each($n => {
            const node = $n.get();
            if (node && node.style) {
                Object.assign(node.style, styles);
            }
        });
    }

    // rect
    rect() {
        const offset = this.offset();
        const width = this.width();
        const height = this.height();
        const top = Math.round(offset.top);
        const left = Math.round(offset.left);

        return { top, left, bottom: top + height, right: left + width, width, height };
    }

    // attr
    attr(name, value, data = false) {
        data = data ? 'data-' : '';

        if (typeof value === 'undefined' && typeof name !== 'object') {
            const node = this.get();
            if (node && node.nodeType !== 3) {
                return name === 'checked' ? node.checked : this._boolean(node.getAttribute(data + name));
            }
            return undefined;
        }

        // set
        return this.each($n => {
            const node = $n.get();
            if (!node || node.nodeType === 3) return;

            const attributes = typeof name === 'object' ? name : { [name]: value };
            Object.entries(attributes).forEach(([key, val]) => {
                if (key === 'checked') {
                    node.checked = val;
                } else {
                    node.setAttribute(data + key, val);
                }
            });
        });
    }

    data(name, value) {
        if (name === undefined || name === true) {
            const reDataAttr = /^data-(.+)$/;
            const attrs = this.get().attributes;
            const data = {};

            Array.from(attrs).forEach(attr => {
                if (reDataAttr.test(attr.nodeName)) {
                    let dataName = attr.nodeName.match(reDataAttr)[1];
                    let val = attr.value;

                    if (name !== true) {
                        dataName = dataName.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
                    }

                    if (val.startsWith('{')) {
                        val = this._object(val);
                    } else {
                        val = this._number(val) ? parseFloat(val) : this._boolean(val);
                    }

                    data[dataName] = val;
                }
            });

            return data;
        }

        return this.attr(name, value, true);
    }

    val(value) {
        if (value === undefined) {
            const el = this.get();
            if (el.type === 'checkbox') {
                return el.checked;
            }
            return el.value;
        }

        return this.each($n => {
            const el = $n.get();
            if (el.type === 'checkbox') {
                el.checked = value;
            } else {
                el.value = value;
            }
        });
    }

    removeAttr(value) {
        return this.each($n => {
            const node = $n.get();
            if (node.nodeType !== 3) {
                value.split(' ').forEach(name => node.removeAttribute(name));
            }
        });
    }

    removeEmptyAttr(name) {
        return this.attr(name) === '' && !!this.removeAttr(name);
    }

    tag(value) {
        let el = this.get();
        if (el.nodeType === 3) return false;

        let tag = el.tagName.toLowerCase();
        return value === undefined ? tag : value.toLowerCase() === tag;
    }

    tagName(value) { // @deprecated 5.0
        return this.tag(value);
    }

    // html & text
    empty() {
        return this.each($n => {
            $n.get().innerHTML = '';
        });
    }

    html(html) {
        if (html === undefined) {
            return this.get().innerHTML || '';
        }
        return this.empty().append(html);
    }

    text(text) {
        if (text === undefined) {
            return this.get().textContent || '';
        }
        return this.each($n => {
            $n.get().textContent = text;
        });
    }

    outer() {
        return this.get().outerHTML;
    }

    // manipulation
    after(...contents) {
        contents.forEach(el => this._insert(el, 'after'));
        return this;
    }

    before(...contents) {
        contents.forEach(el => this._insert(el, 'before'));
        return this;
    }

    append(...contents) {
        contents.forEach(el => this._insert(el, 'append'));
        return this;
    }

    prepend(...contents) {
        contents.forEach(el => this._insert(el, 'prepend'));
        return this;
    }

    wrap(html) {
        return this._inject(html, (frag, node) => {
            const wrapper = (typeof frag === 'string' || typeof frag === 'number')
                ? this.create(frag)[0]
                : frag instanceof Node
                    ? frag
                    : this._array(frag)[0];

            if (node.parentNode) {
                node.parentNode.insertBefore(wrapper, node);
            }

            wrapper.appendChild(node);
            return wrapper;
        });
    }

    unwrap() {
        return this.each($n => {
            const node = $n.get();
            const docFrag = document.createDocumentFragment();

            while (node.firstChild) {
                docFrag.appendChild(node.firstChild);
            }

            if (node.parentNode) {
                node.parentNode.replaceChild(docFrag, node);
            }
        });
    }

    replaceWith(content) {
        return this._inject(content, (frag, node) => {
            const docFrag = document.createDocumentFragment();
            const elements = (typeof frag === 'string' || typeof frag === 'number')
                ? this.create(frag)
                : frag instanceof Node
                    ? [frag]
                    : this._array(frag);

            elements.forEach(el => docFrag.appendChild(el));

            const result = docFrag.firstChild;

            if (node.parentNode) {
                node.parentNode.replaceChild(docFrag, node);
            }

            return result;
        }, true);
    }

    replaceTag(newTag, keepChildren = true) {
        const results = this.nodes.map(node => {
            const newElement = document.createElement(newTag);

            if (keepChildren) {
                while (node.firstChild) {
                    newElement.appendChild(node.firstChild);
                }
            }

            Array.from(node.attributes).forEach(attr => {
                newElement.setAttribute(attr.name, attr.value);
            });

            if (node.parentNode) {
                node.parentNode.replaceChild(newElement, node);
            }

            return newElement;
        });

        return new Dom(results);
    }

    remove() {
        return this.each($n => {
            $n.get().remove();
        });
    }

    // clone
    clone(events) {
        const clones = [];
        this.each($n => {
            let node = $n.get();
            let copy = this._clone(node);
            if (events) {
                copy = this._cloneEvents(node, copy);
            }
            clones.push(copy);
        });

        return new Dom(clones);
    }

    cloneAttrs(el) {
        const $el = new Dom(el);
        if ($el.length) {
            return this.each($n => {
                const attrs = $n.get().attributes;
                for (const attr of attrs) {
                    $el.attr(attr.name, attr.value);
                }
            });
        }

        return this;
    }

    cloneEmpty() {
        return new Dom(`<${this.tag()}>`);
    }

    // display
    toggle(force) {
        return this.each($n => {
            const node = $n.get();
            if (!node || !node.style) return;

            if (force === undefined) {
                this._hasDisplayNone(node) ? $n.show() : $n.hide();
            } else {
                force ? $n.show() : $n.hide();
            }
        });
    }

    show() {
        return this.each($n => {
            const node = $n.get();
            if (!node.style || !this._hasDisplayNone(node)) return;

            const targetDisplay = node.getAttribute('domTargetShow') || 'block';
            node.style.setProperty('display', targetDisplay, 'important');
            node.removeAttribute('domTargetShow');
        });
    }

    hide() {
        return this.each($n => {
            const node = $n.get();
            if (!node.style || this._hasDisplayNone(node)) return;

            const currentDisplay = node.style.display;
            if (currentDisplay && currentDisplay !== 'block') {
                node.setAttribute('domTargetShow', currentDisplay);
            }
            node.style.setProperty('display', 'none', 'important');
        });
    }

    // scroll
    scrollTop(value) {
        const node = this.get();
        const isWindow = this._isWindowNode(node);
        const isDocument = node.nodeType === 9;
        const el = isDocument ? (node.scrollingElement || node.documentElement) : node;

        if (typeof value !== 'undefined') {
            const scrollValue = parseInt(value, 10);
            if (isWindow) {
                node.scrollTo(0, scrollValue);
            } else {
                el.scrollTop = scrollValue;
            }
            return this;
        }

        return isWindow ? node.pageYOffset : el.scrollTop;
    }

    scroll() {
        this.get().scrollIntoView({ behavior: 'smooth' });
    }

    // position
    offset() {
        return this._getPos('offset');
    }

    position() {
        return this._getPos('position');
    }

    // dimensions
    width(value) {
        return value !== undefined
            ? this.css('width', `${parseInt(value, 10)}px`)
            : this._getSize('width', 'Width');
    }

    height(value) {
        return value !== undefined
            ? this.css('height', `${parseInt(value, 10)}px`)
            : this._getSize('height', 'Height');
    }

    outerWidth() {
        return this._getSize('width', 'Width', 'outer');
    }

    outerHeight() {
        return this._getSize('height', 'Height', 'outer');
    }

    innerWidth() {
        return this._getSize('width', 'Width', 'inner');
    }

    innerHeight() {
        return this._getSize('height', 'Height', 'inner');
    }

    // events
    click() {
        return this._trigger('click');
    }

    focus(options = {}) {
        return this._trigger('focus', options);
    }

    blur() {
        return this._trigger('blur');
    }

    on(names, handler, one = false) {
        return this.each($n => {
            const node = $n.get();
            const events = names.split(' ');

            events.forEach(eventFullName => {
                const event = this._getEventName(eventFullName);
                const namespace = this._getEventNamespace(eventFullName);

                const eventHandler = one ? this._getOneHandler(handler, names) : handler;
                node.addEventListener(event, eventHandler);

                node._e = node._e || {};
                node._e[namespace] = node._e[namespace] || {};
                node._e[namespace][event] = node._e[namespace][event] || [];
                node._e[namespace][event].push(eventHandler);
            });
        });
    }

    one(events, handler) {
        return this.on(events, handler, true);
    }

    off(names, handler) {
        const testEvent = (name, key, event) => name === event;
        const testNamespace = (name, key, event, namespace) => key === namespace;
        const testEventNamespace = (name, key, event, namespace) => name === event && key === namespace;
        const testPositive = () => true;

        if (names === undefined) {
            // remove all events
            return this.each($n => {
                this._offEvent($n.get(), false, false, handler, testPositive);
            });
        }

        return this.each($n => {
            const node = $n.get();
            const events = names.split(' ');

            events.forEach(eventFullName => {
                const event = this._getEventName(eventFullName);
                const namespace = this._getEventNamespace(eventFullName);

                if (namespace === '_events') {
                    this._offEvent(node, event, namespace, handler, testEvent);
                } else if (!event && namespace !== '_events') {
                    this._offEvent(node, event, namespace, handler, testNamespace);
                } else {
                    this._offEvent(node, event, namespace, handler, testEventNamespace);
                }
            });
        });
    }

    // form
    serialize(asObject = false) {
        const obj = {};
        const elements = this.get().elements;

        Array.from(elements).forEach(el => {
            if ((/(checkbox|radio)/.test(el.type) && !el.checked) ||
                !el.name || el.disabled || el.type === 'file') {
                return;
            }

            if (el.type === 'select-multiple') {
                Array.from(el.options).forEach(opt => {
                    if (opt.selected) {
                        obj[el.name] = opt.value;
                    }
                });
            } else {
                obj[el.name] = this._number(el.value) ? parseFloat(el.value) : this._boolean(el.value);
            }
        });

        return asObject ? obj : this._params(obj);
    }

    // animation
    fadeIn(speed, fn) {
        const anim = this._anim(speed, fn, 500);

        return this.each($n => {
            $n.css({
                display: 'block',
                opacity: 0,
                animation: `fadeIn ${anim.speed}s ease-in-out`
            }).removeClass('hidden');

            $n.one('animationend', () => {
                $n.css({ opacity: '', animation: '' });
                if (anim.fn) anim.fn($n);
            });
        });
    }

    fadeOut(speed, fn) {
        const anim = this._anim(speed, fn, 300);

        return this.each($n => {
            $n.css({
                opacity: 1,
                animation: `fadeOut ${anim.speed}s ease-in-out`
            });

            $n.one('animationend', () => {
                $n.css({ display: 'none', opacity: '', animation: '' });
                if (anim.fn) anim.fn($n);
            });
        });
    }

    slideUp(speed, fn) {
        const anim = this._anim(speed, fn, 300);

        return this.each($n => {
            const currentHeight = $n.height();
            $n.height(currentHeight);
            $n.css({
                overflow: 'hidden',
                animation: `slideUp ${anim.speed}s ease-out`
            });

            $n.one('animationend', () => {
                $n.css({ display: 'none', height: '', animation: '' });
                if (anim.fn) anim.fn($n);
            });
        });
    }

    slideDown(speed, fn) {
        const anim = this._anim(speed, fn, 400);

        return this.each($n => {
            const currentHeight = $n.height();
            $n.height(currentHeight);
            $n.css({
                display: 'block',
                overflow: 'hidden',
                animation: `slideDown ${anim.speed}s ease-in-out`
            }).removeClass('hidden');

            $n.one('animationend', () => {
                $n.css({ overflow: '', height: '', animation: '' });
                if (anim.fn) anim.fn($n);
            });
        });
    }

    // private
    _params(obj) {
        return Object.keys(obj)
            .map(key => `${this._encodeUri(key)}=${this._encodeUri(obj[key])}`)
            .join('&');
    }

    _encodeUri(str) {
        return encodeURIComponent(str)
            .replace(/!/g, '%21')
            .replace(/'/g, '%27')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/\*/g, '%2A')
            .replace(/%20/g, '+');
    }

    _getOneHandler(handler, events) {
        return (...args) => {
            handler.apply(this, args);
            this.off(events, handler);
        };
    }

    _getEventNamespace(event) {
        const [_, namespace = '_events', extra] = event.split('.');
        return extra ? `${namespace}${extra}` : namespace;
    }

    _getEventName(event) {
        return event.split('.')[0];
    }

    _offEvent(node, event, namespace, handler, condition) {
        Object.keys(node._e || {}).forEach(key => {
            Object.keys(node._e[key]).forEach(name => {
                if (condition(name, key, event, namespace)) {
                    const handlers = node._e[key][name];
                    for (let i = handlers.length - 1; i >= 0; i--) {
                        if (!handler || handlers[i].toString() === handler.toString()) {
                            node.removeEventListener(name, handlers[i]);
                            handlers.splice(i, 1);
                        }
                    }

                    if (handlers.length === 0) {
                        delete node._e[key][name];
                    }
                    if (Object.keys(node._e[key]).length === 0) {
                        delete node._e[key];
                    }
                }
            });
        });
    }

    _trigger(name, options = {}) {
        const node = this.get();
        if (node && node.nodeType !== 3 && typeof node[name] === 'function') {
            node[name](options);
        }
        return this;
    }

    _hasDisplayNone(el) {
        const display = el.style.display || getComputedStyle(el).display;
        return display === 'none';
    }

    _clone(node) {
        if (node === undefined) return;
        if (typeof node === 'string') return node;
        if (node instanceof Node) return node.cloneNode(true);
        if ('length' in node) {
            return Array.from(this._array(node)).map(el => el.cloneNode(true));
        }
    }

    _cloneEvents(node, copy) {
        if (node._e) {
            copy._e = { ...node._e }; // clone events

            for (const [name, handlers] of Object.entries(node._e._events || {})) {
                handlers.forEach(handler => copy.addEventListener(name, handler));
            }
        }

        return copy;
    }

    _insert(html, position) {
        return this._inject(html, (frag, node) => {
            const positionsMap = {
                after: 'afterend',
                before: 'beforebegin',
                append: 'beforeend',
                prepend: 'afterbegin'
            };

            if (typeof frag === 'string' || typeof frag === 'number') {
                node.insertAdjacentHTML(positionsMap[position], frag);
            } else {
                let elements = frag instanceof Node ? [frag] : this._array(frag);

                if (position === 'after') elements.reverse();
                elements.forEach(el => node[position](el));
            }
            return node;
        });
    }

    _inject(html, fn, wrapNodeInDom = false) {
        const nodes = this.nodes.map((node, index) => {
            const $n = wrapNodeInDom ? new Dom(node) : node;
            const content = typeof html === 'function' ? html.call(this, $n) : html;
            const fragment = index === 0 ? content : this._clone(content);
            return fn.call(this, fragment, node);
        });

        return new Dom(nodes.filter(node => node));
    }

    _getSize(name, cname, type = '') {
        const el = this.get();
        let value = 0;

        if (!el) return 0;
        if (el.nodeType === 3) return 0;
        if (el.nodeType === 9) return this._getDocSize(el, cname);
        if (this._isWindowNode(el)) return window[`inner${cname}`];
        if (type === 'outer') return el[`offset${cname}`];
        if (type === 'inner') return el[`client${cname}`];
        return this._getDimensions(name);
    }

    _getDocSize(node, type) {
        const body = node.body;
        const html = node.documentElement;

        return Math.max(
            body[`scroll${type}`],
            body[`offset${type}`],
            html[`client${type}`],
            html[`scroll${type}`],
            html[`offset${type}`]
        );
    }

    _getPos(type) {
        const node = this.get();
        const dim = { top: 0, left: 0 };

        if (node.nodeType === 3 || this._isWindowNode(node) || node.nodeType === 9) {
            return dim;
        }

        if (type === 'position') {
            return { top: node.offsetTop, left: node.offsetLeft };
        }

        if (type === 'offset') {
            const rect = node.getBoundingClientRect();
            const doc = node.ownerDocument;
            const docElem = doc.documentElement;
            const win = doc.defaultView;

            return {
                top: Math.round(rect.top + win.pageYOffset - docElem.clientTop),
                left: Math.round(rect.left + win.pageXOffset - docElem.clientLeft)
            };
        }

        return dim;
    }

    _getDimensions(name) {
        const cname = name.charAt(0).toUpperCase() + name.slice(1);
        const el = this.get();
        if (!el) return 0;

        const style = getComputedStyle(el);
        let result = 0;

        const $targets = this.parents().filter($n => {
            const node = $n.get();
            return node.nodeType === 1 && getComputedStyle(node).display === 'none';
        });

        if (style.display === 'none') $targets.add(el);

        if ($targets.length !== 0) {
            const fixStyle = 'visibility: hidden !important; display: block !important;';
            const tmp = [];

            $targets.each(($n, i) => {
                const thisStyle = $n.attr('style');
                tmp[i] = thisStyle !== null ? thisStyle : '';
                $n.attr('style', thisStyle ? thisStyle + ';' + fixStyle : fixStyle);
            });

            result = el[`offset${cname}`];

            $targets.each(($n, i) => {
                if (tmp[i]) {
                    $n.attr('style', tmp[i]);
                } else {
                    $n.removeAttr('style');
                }
            });
        } else {
            result = el[`offset${cname}`];
        }

        return result;
    }

    _boolean(str) {
        return str === 'true' ? true : str === 'false' ? false : str;
    }

    _number(str) {
        return !isNaN(str) && !isNaN(parseFloat(str));
    }

    _object(str) {
        try {
            const jsonStr = str.replace(/(\w+)\s*:/g, '"$1":');
            return JSON.parse(jsonStr);
        } catch (error) {
            return null;
        }
    }

    _eachClass(value, type) {
        return this.each(($n, index) => {
            const node = $n.get();

            if (typeof value === 'function') {
                const result = value(node.className);
                if (result) {
                    result.split(' ').forEach(cls => node.classList[type](cls));
                }
            } else if (value) {
                value.split(' ').forEach(cls => node.classList[type](cls));
            }
        });
    }

    _sibling(s, method) {
        let sibling = null;
        this.each($n => {
            let node = $n.get();
            while (node = node[method]) {
                if (s instanceof Node ? node === s : new Dom(node).is(s)) {
                    sibling = node;
                    break;
                }
            }
        });
        return new Dom(sibling);
    }

    _array(o) {
        if (o === undefined) return [];
        if (o instanceof NodeList) return Array.from(o);
        if (o instanceof Dom) return o.nodes;
        if (typeof o === 'object') return Array.from(o);

        return Array.isArray(o) ? o : [o];
    }

    _slice(o) {
        return Array.from(o?.nodes || o || []);
    }

    _query(s, c) {
        return c ? this._queryContext(s, c) : this._simpleQuery(s);
    }

    _simpleQuery(s) {
        const d = document;
        if (/^[.#]?[\w-]*$/.test(s)) {
            return s[0] === '#' ? [d.getElementById(s.slice(1))].filter(Boolean)
                : s[0] === '.' ? d.getElementsByClassName(s.slice(1))
                : d.getElementsByTagName(s);
        }
        return d.querySelectorAll(s);
    }

    _queryContext(s, c) {
        c = this._context(c);
        return (c.nodeType !== 3 && typeof c.querySelectorAll === 'function') ? c.querySelectorAll(s) : [];
    }

    _context(c) {
        return (!c) ? document : ((typeof c === 'string') ? document.querySelector(c) : c);
    }

    _isWindowNode(node) {
        return node === window || node?.parent === window;
    }

    _anim(speed, fn, speedDef) {
        if (typeof speed === 'function') {
            fn = speed;
            speed = speedDef;
        } else {
            speed = speed || speedDef;
        }
        return { fn: fn || null, speed: speed / 1000 };
    }
}
// Version 2.0 | 26.11.2021
var Ajax = {};

Ajax.settings = {};
Ajax.post = function(options) { return new AjaxRequest('post', options); };
Ajax.get = function(options) { return new AjaxRequest('get', options); };
Ajax.request = function(method, options) { return new AjaxRequest(method, options); };

var AjaxRequest = function(method, options) {
    var defaults = {
        method: method,
        url: '',
        before() {},
        success() {},
        error() {},
        data: false,
        async: true,
        headers: {}
    };

    this.p = this.extend(defaults, options);
    this.p = this.extend(this.p, Ajax.settings);
    this.p.method = this.p.method.toUpperCase();

    this.prepareData();

    this.xhr = new XMLHttpRequest();
    this.xhr.open(this.p.method, this.p.url, this.p.async);

    this.setHeaders();

    var before = (typeof this.p.before === 'function') ? this.p.before(this.xhr) : true;
    if (before !== false) {
        this.send();
    }
};

AjaxRequest.prototype = {
    extend(obj1, obj2) {
        if (obj2) {
            Object.keys(obj2).forEach(function(key) {
                obj1[key] = obj2[key];
            });
        }
        return obj1;
    },
    prepareData() {
        if (['POST', 'PUT'].indexOf(this.p.method) !== -1 && !this.isFormData()) this.p.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        if (typeof this.p.data === 'object' && !this.isFormData()) this.p.data = this.toParams(this.p.data);
        if (this.p.method === 'GET') {
            var sign = (this.p.url.search(/\?/) !== -1) ? '&' : '?';
            this.p.url = (this.p.data) ? this.p.url + sign + this.p.data : this.p.url;
        }
    },
    setHeaders() {
        this.xhr.setRequestHeader('X-Requested-With', this.p.headers['X-Requested-With'] || 'XMLHttpRequest');
        Object.keys(this.p.headers).forEach(function(key) {
            this.xhr.setRequestHeader(key, this.p.headers[key]);
        }.bind(this));
    },
    isFormData() {
        return (typeof window.FormData !== 'undefined' && this.p.data instanceof window.FormData);
    },
    isComplete() {
        return !(this.xhr.status < 200 || (this.xhr.status >= 300 && this.xhr.status !== 304));
    },
    send() {
        if (this.p.async) {
            this.xhr.onload = this.loaded.bind(this);
            this.xhr.send(this.p.data);
        }
        else {
            this.xhr.send(this.p.data);
            this.loaded.call(this);
        }
    },
    loaded() {
        var response;
        if (this.isComplete()) {
            response = this.parseResponse();
            if (typeof this.p.success === 'function') this.p.success(response, this.xhr);
        }
        else {
            response = this.parseResponse();
            if (typeof this.p.error === 'function') this.p.error(response, this.xhr, this.xhr.status);
        }
    },
    parseResponse() {
        var response = this.xhr.response;
        var json = this.parseJson(response);
        return (json) ? json : response;
    },
    parseJson(str) {
        try {
            var o = JSON.parse(str);
            if (o && typeof o === 'object') {
                return o;
            }

        } catch (e) {
            return false;
        }

        return false;
    },
    toParams(obj) {
        return Object.keys(obj).map(
            function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]); }
        ).join('&');
    }
};
/*jshint esversion: 6 */
// Unique ID
let re_uuid = 0;

// Wrapper
let Redactor = function(selector, settings) {
    let elms = new Dom(selector);
    let instance;

    elms.each((el) => {
        instance = el.dataget(Redactor.namespace);
        if (!instance) {
            // Initialization
            instance = new App(el, settings, re_uuid);
            el.dataset(Redactor.namespace, instance);
            Redactor.instances[re_uuid] = instance;
            re_uuid++;
        }
    });

    return (elms.length > 1) ? Redactor.instances : instance;
};

// Dom & Ajax
Redactor.dom = function(selector) { return new Dom(selector); };
Redactor.ajax = Ajax;

// Globals
Redactor.mapping = {};
Redactor._mixins = {};
Redactor.instances = [];
Redactor.namespace = 'redactor';
Redactor.version = '4.4.6';
Redactor.settings = {};
Redactor.lang = {};
Redactor.triggers = {};
Redactor.customTags = [];
Redactor.keycodes = {
    BACKSPACE: 8,
    DELETE: 46,
    UP: 38,
    DOWN: 40,
    ENTER: 13,
    SPACE: 32,
    ESC: 27,
    TAB: 9,
    CTRL: 17,
    META: 91,
    SHIFT: 16,
    ALT: 18,
    RIGHT: 39,
    LEFT: 37
};

// Add
Redactor.add = function(type, name, obj) {
    // translations
    if (obj.translations) {
        Redactor.lang = Redactor.extend(true, Redactor.lang, obj.translations);
    }

    // defaults
    if (type !== 'block' && obj.defaults) {
        let localopts = {};
        localopts[name] = obj.defaults;
        Redactor.opts = Redactor.extend(true, Redactor.opts, localopts);
    }

    // paragraphize tags
    if (type === 'block' && obj.props.custom) {
        Redactor.customTags.push(obj.props.custom);
    }

    // extend block props
    if (obj.nested) {
       Redactor.opts.nested.push(name);
       Redactor.opts.nestedValue.push(obj.nested);
    }
    if (typeof obj.parser !== 'undefined' && obj.parser === false) {
       Redactor.opts.nonparse.push(name);
    }
    if (obj.triggers) {
        Redactor.triggers = Redactor.extend(true, Redactor.triggers, obj.triggers);
    }

    // mixins
    if (type === 'mixin') {
        Redactor._mixins[name] = obj;
    }
    else {
        // prototype
        let F = function() {};
        F.prototype = obj;

        // mixins
        if (obj.mixins) {
            for (let z = 0; z < obj.mixins.length; z++) {
                Redactor.inherit(F, Redactor._mixins[obj.mixins[z]]);
            }
        }

        if (typeof Redactor.mapping[type] === 'undefined') {
            Redactor.mapping[type] = {};
        }
        Redactor.mapping[type][name] = { type: type, proto: F, obj: obj };
    }
};

// Lang
Redactor.addLang = function(lang, obj) {
    if (typeof lang === 'object') {
        Redactor.lang = Redactor.extend(true, {}, Redactor.lang, lang);
    }
    else {
        if (typeof Redactor.lang[lang] === 'undefined') {
            Redactor.lang[lang] = {};
        }
        Redactor.lang[lang] = Redactor.extend(true, Redactor.lang[lang], obj);

    }
};

// Extend
Redactor.extend = function() {
    let extended = {}, deep = false, i = 0, prop, merge;
    let length = arguments.length;

    if (Object.prototype.toString.call(arguments[0]) === '[object Boolean]') {
        deep = arguments[0];
        i++;
    }

    merge = function(obj) {
        for (prop in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, prop)) {
                if (obj[prop] && (obj[prop].set === true || obj[prop]._replace === true)) {
                    extended[prop] = {};
                }

                if (deep && Object.prototype.toString.call(obj[prop]) === '[object Object]') {
                    extended[prop] = Redactor.extend(true, extended[prop], obj[prop]);
                }
                else {
                    extended[prop] = obj[prop];
                }

                if (typeof extended[prop] !== 'undefined') {
                    delete extended[prop].set;
                    delete extended[prop]._replace;
                }
            }
        }
    };

    for (; i < length; i++) {
        let obj = arguments[i];
        merge(obj);
    }

    return extended;
};

// Inherit
Redactor.inherit = function(current, parent) {
    let F = function() {};
    F.prototype = parent;
    let f = new F();

    for (let prop in current.prototype) {
        if (current.prototype.__lookupGetter__(prop)) f.__defineGetter__(prop, current.prototype.__lookupGetter__(prop));
        else f[prop] = current.prototype[prop];
    }

    current.prototype = f;
    current.prototype.super = parent;

    return current;
};
Redactor.opts = {
    plugins: [],
    focus: false, // true, 'end'
    tabindex: false,
    content: false,
    data: false,
    output: false,
    css: false,
    cssFile: 'redactor.min.css',
    frame: {
        lang: false,
        dir: false
    },
    doctype: '<!doctype html>',
    csscache: false,
    custom: {
        css: false,
        js: false
    },
    lang: 'en',
    breakline: false,
    markup: 'p',
    structure: false,
    command: true,
    nocontainer: false,
    nostyle: false,
    https: false,
    clicktoedit: false,
    theme: 'auto', // light, dark
    themeAttr: false,
    placeholder: false,
    readonly: false,
    disabled: false,
    dataBlock: 'data-block',
    classname: 'rx-content',
    dir: 'ltr',
    reloadmarker: true,
    addPosition: 'top', // bottom
    spellcheck: true,
    grammarly: false,
    notranslate: false,
    width: '100%', // string
    padding: '20px 28px',
    minHeight: '72px', // string: '500px', false
    maxHeight: false, // string: '500px', false
    classes: false,
    templateSyntax: false,
    source: true,
    enterKey: true, // false
    drop: true,
    draggable: false,
    reorder: true,
    scrollTarget: false,
    scrollOverflow: false,
    sync: true,
    syncDelay: 300,
    codemirror: false,
    codemirrorSrc: false,
    ai: false,
    bsmodal: false,
    paragraphize: true,
    paragraphizer: {
        selfClosingXmlTags: false
    },
    block: {
        outline: true
    },
    colorpicker: {
        size: false,
        wrap: false,
        row: false,
        width: false
    },
    container: {
        border: true
    },
    state: {
        limit: 200
    },
    autosave: {
        url: false,
        name: false,
        data: false,
        method: 'post',
        interval: false
    },
    toolbar: {
        raised: false,
        target: false,
        sharedTarget: false,
        sticky: true,
        stickyMinHeight: 200, // pixels
        stickyTopOffset: 0 // number
    },
    statusbar: {
        sticky: false,
        target: false
    },
    pathbar: false,
    control: true,
    context: false,
    clean: {
        comments: false,
        enter: true,
        enterinline: true
    },
    tab: {
        key: true,
        spaces: false // true or number of spaces
    },
    format: true,
    addbar: true,
    extrabar: true,
    addbarItems: {},
    inlineItems: {},
    formatItems: {},
    replaceTags: false,
    buttons: {
        toolbar: ['add', 'ai-tools', 'html', 'format', 'bold', 'italic', 'deleted', 'moreinline', 'list', 'link', 'image', 'table'],
        extrabar: ['hotkeys'], // undo, redo
        control: ['toggle'], // , 'add'
        context: ['ai-tools', 'format', 'bold', 'italic', 'deleted', 'moreinline', 'link'], // highlight, sub, sup, kbd
        icons: false
    },
    popups: {
        format: ['text', 'h1', 'h2', 'h3', 'h4', 'quote', 'bulletlist', 'numberedlist', 'todo'], // h5, h6, address
        control: ['add', 'move-up', 'move-down', 'duplicate', 'trash'],
        addbar: ['ai-prompt', 'ai-image', 'text', 'heading', 'image', 'todo', 'list', 'embed', 'table', 'quote', 'pre', 'line', 'layout', 'wrapper'], // address, dlist
        inline: ['code', 'underline', 'sup', 'sub', 'highlight', 'removeinline']
    },
    active: {
        tags: {
            'b': ['bold'],
            'strong': ['bold'],
            'i': ['italic'],
            'em': ['italic'],
            'del': ['deleted'],
            'u': ['underline'],
            'a': ['link'],
            'code': ['code'],
            'mark': ['mark'],
            'sub': ['subscript'],
            'sup': ['superscript'],
            'h1': ['h1'],
            'h2': ['h2'],
            'h3': ['h3'],
            'h4': ['h4'],
            'h5': ['h5'],
            'h6': ['h6'],
            'ul': ['bulletlist'],
            'ol': ['numberedlist']
        },
        blocks: {
           'listitem': ['list'],
           'list': ['list'],
           'pre': ['pre'],
           'table': ['table'],
           'cell': ['table'],
           'image': ['image'],
           'embed': ['embed'],
           'layout': ['layout'],
           'wrapper': ['wrapper'],
           'todo': ['todo'],
           'text': ['text'],
           'quote': ['quote']
        }
    },
    paste: {
        clean: true,
        autoparse: true,
        paragraphize: true,
        paragraphizeLines: false,
        stripAttr: true,
        plaintext: false,
        linkTarget: false,
        images: true,
        links: true,
        keepIdAttr: false,
        keepNameAttr: false,
        keepClass: [],
        keepStyle: [],
        keepAttrs: ['td', 'th'],
        keepWordFormatting: {},
        keepEmptyLines: false,
        formTags: ['form', 'input', 'button', 'select', 'textarea', 'legend', 'fieldset'],
        blockTags: ['pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tbody', 'thead', 'tfoot', 'th', 'tr', 'td', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'p', 'hr', 'figure', 'iframe', 'figcaption', 'address'],
        inlineTags: ['a', 'svg', 'img', 'br', 'strong', 'ins', 'code', 'del', 'span', 'samp', 'kbd', 'sup', 'sub', 'mark', 'var', 'cite', 'small', 'b', 'u', 'em', 'i', 'abbr']
    },

    // blocks
    link: {
        create: false,
        edit: false,
        truncate: 24
    },
    image: {
        create: false,
        edit: false,
        states: true,
        upload: false,
        url: true,
        select: false,
        selectMethod: 'get',
        name: 'file',
        data: false,
        drop: true,
        multiple: true,
        clipboard: true,
        types: ['image/*'],
        tag: 'figure', // p, div, figure
        newtab: false,
        link: true,
        width: false
    },
    layout: {
        grid: false,
        column: false
    },
    layouts: {
        'single': {
            title: '## layout.single-column ##',
            pattern: '100%'
        },
        'two-columns': {
            title: '## layout.two-columns ##',
            pattern: '50%|50%'
        },
        'three-columns': {
            title: '## layout.three-columns ##',
            pattern: '33%|33%|33%'
        },
        'four-columns': {
            title: '## layout.four-columns ##',
            pattern: '25%|25%|25%|25%'
        },
        '60-40': {
            title: '60/40',
            pattern: '60%|40%'
        },
        '40-60': {
            title: '40/60',
            pattern: '40%|60%'
        }
    },
    wrapper: {
        template: '<div></div>'
    },
    figcaption: {
        template: '<figcaption></figcaption>'
    },
    line: {
        template: '<hr>'
    },
    noneditable: {
        remove: true,
        select: true
    },
    pre: {
        template: '<pre></pre>',
        spaces: 4 // or false
    },
    table: {
        template: '<table><tr><td></td><td></td></tr><tr><td></td><td></td></tr></table>',
        nowrap: 'nowrap'
    },
    todo: {
        toggleClass: false,
        templateItem: '[ ]',
        templateItemDone: '[x]',
        templateInput: '<input type="checkbox">',
        templateContent: '<div></div>',
        template: false
    },
    quote: {
        template: '<blockquote><p data-placeholder="Quote..."></p><p><cite data-placeholder="Attribution"></cite></p></blockquote>'
    },
    embed: {
        classname: 'embed-content',
        responsive: false,
        responsiveClassname: 'embed-responsive',
        script: true
    },
    outset: {
        none: 'none',
        left: 'outset-left',
        both: 'outset-both',
        right: 'outset-right'
    },
    wrapWithStyle: false,
    wrap: {
        none: 'none',
        left: 'float-left',
        center: 'wrap-center',
        right: 'float-right'
    },
    colors: {
        base:   ['#000000', '#ffffff'],
        gray:   ['#212529', '#343a40', '#495057', '#868e96', '#adb5bd', '#ced4da', '#dee2e6', '#e9ecef', '#f1f3f5', '#f8f9fa'],
        red:    ["#c92a2a", "#e03131", "#f03e3e", "#fa5252", "#ff6b6b", "#ff8787", "#ffa8a8", "#ffc9c9", "#ffe3e3", "#fff5f5"],
        pink:   ["#a61e4d", "#c2255c", "#d6336c", "#e64980", "#f06595", "#f783ac", "#faa2c1", "#fcc2d7", "#ffdeeb", "#fff0f6"],
        grape:  ["#862e9c", "#9c36b5", "#ae3ec9", "#be4bdb", "#cc5de8", "#da77f2", "#e599f7", "#eebefa", "#f3d9fa", "#f8f0fc"],
        violet: ["#5f3dc4", "#6741d9", "#7048e8", "#7950f2", "#845ef7", "#9775fa", "#b197fc", "#d0bfff", "#e5dbff", "#f3f0ff"],
        indigo: ["#364fc7", "#3b5bdb", "#4263eb", "#4c6ef5", "#5c7cfa", "#748ffc", "#91a7ff", "#bac8ff", "#dbe4ff", "#edf2ff"],
        blue:   ["#1864ab", "#1971c2", "#1c7ed6", "#228be6", "#339af0", "#4dabf7", "#74c0fc", "#a5d8ff", "#d0ebff", "#e7f5ff"],
        cyan:   ["#0b7285", "#0c8599", "#1098ad", "#15aabf", "#22b8cf", "#3bc9db", "#66d9e8", "#99e9f2", "#c5f6fa", "#e3fafc"],
        teal:   ["#087f5b", "#099268", "#0ca678", "#12b886", "#20c997", "#38d9a9", "#63e6be", "#96f2d7", "#c3fae8", "#e6fcf5"],
        green:  ["#2b8a3e", "#2f9e44", "#37b24d", "#40c057", "#51cf66", "#69db7c", "#8ce99a", "#b2f2bb", "#d3f9d8", "#ebfbee"],
        lime:   ["#5c940d", "#66a80f", "#74b816", "#82c91e", "#94d82d", "#a9e34b", "#c0eb75", "#d8f5a2", "#e9fac8", "#f4fce3"],
        yellow: ["#e67700", "#f08c00", "#f59f00", "#fab005", "#fcc419", "#ffd43b", "#ffe066", "#ffec99", "#fff3bf", "#fff9db"],
        orange: ["#d9480f", "#e8590c", "#f76707", "#fd7e14", "#ff922b", "#ffa94d", "#ffc078", "#ffd8a8", "#ffe8cc", "#fff4e6"]
    },
    hotkeysAdd: false,
    hotkeysRemove: false,
    hotkeysBase: {
        'meta+z': '## hotkeys.meta-z ##',
        'meta+shift+z': '## hotkeys.meta-shift-z ##',
        'meta+a': '## hotkeys.meta-a ##',
        'meta+shift+a': '## hotkeys.meta-shift-a ##'
    },
    hotkeys: {
        'ctrl+alt+a, meta+alt+a': {
            title: '## hotkeys.meta-shift-o ##',
            name: 'meta+alt+a',
            command: 'addbar.popup'
        },
        'ctrl+shift+d, meta+shift+d': {
            title: '## hotkeys.meta-shift-d ##',
            name: 'meta+shift+d',
            command: 'block.duplicate'
        },
        'ctrl+shift+up, meta+shift+up': {
            title: '## hotkeys.meta-shift-up ##',
            name: 'meta+shift+&uarr;',
            command: 'block.moveUp'
        },
        'ctrl+shift+down, meta+shift+down': {
            title: '## hotkeys.meta-shift-down ##',
            name: 'meta+shift+&darr;',
            command: 'block.moveDown'
        },
        'ctrl+shift+m, meta+shift+m': {
            title: '## hotkeys.meta-shift-m ##',
            name: 'meta+shift+m',
            command: 'inline.removeFormat'
        },
        'ctrl+b, meta+b': {
            title: '## hotkeys.meta-b ##',
            name: 'meta+b',
            command: 'inline.set',
            params: { tag: 'b' }
        },
        'ctrl+i, meta+i': {
            title: '## hotkeys.meta-i ##',
            name: 'meta+i',
            command: 'inline.set',
            params: { tag: 'i' }
        },
        'ctrl+u, meta+u': {
            title: '## hotkeys.meta-u ##',
            name: 'meta+u',
            command: 'inline.set',
            params: { tag: 'u' }
        },
        'ctrl+h, meta+h': {
            title: '## hotkeys.meta-h ##',
            name: 'meta+h',
            command: 'inline.set',
            params: { tag: 'sup' }
        },
        'ctrl+l, meta+l': {
            title: '## hotkeys.meta-l ##',
            name: 'meta+l',
            command: 'inline.set',
            params: { tag: 'sub' }
        },
        'ctrl+alt+0, meta+alt+0': {
            title: '## hotkeys.meta-alt-0 ##',
            name: 'meta+alt+0',
            command: 'format.set',
            params: { tag: 'p' }
        },
        'ctrl+alt+1, meta+alt+1': {
            title: '## hotkeys.meta-alt-1 ##',
            name: 'meta+alt+1',
            command: 'format.set',
            params: { tag: 'h1' }
        },
        'ctrl+alt+2, meta+alt+2': {
            title: '## hotkeys.meta-alt-2 ##',
            name: 'meta+alt+2',
            command: 'format.set',
            params: { tag: 'h2' }
        },
        'ctrl+alt+3, meta+alt+3': {
            title: '## hotkeys.meta-alt-3 ##',
            name: 'meta+alt+3',
            command: 'format.set',
            params: { tag: 'h3' }
        },
        'ctrl+alt+4, meta+alt+4': {
            title: '## hotkeys.meta-alt-4 ##',
            name: 'meta+alt+4',
            command: 'format.set',
            params: { tag: 'h4' }
        },
        'ctrl+alt+5, meta+alt+5': {
            title: '## hotkeys.meta-alt-5 ##',
            name: 'meta+alt+5',
            command: 'format.set',
            params: { tag: 'h5' }
        },
        'ctrl+alt+6, meta+alt+6': {
            title: '## hotkeys.meta-alt-6 ##',
            name: 'meta+alt+6',
            command: 'format.set',
            params: { tag: 'h6' }
        },
        'ctrl+shift+7, meta+shift+7': {
            title: '## hotkeys.meta-shift-7 ##',
            name: 'meta+shift+7',
            command: 'format.set',
            params: { tag: 'ol'}
        },
        'ctrl+shift+8, meta+shift+8': {
            title: '## hotkeys.meta-shift-8 ##',
            name: 'meta+shift+8',
            command: 'format.set',
            params: { tag: 'ul' }
        },
        'ctrl+], meta+]': {
            title: '## hotkeys.meta-indent ##',
            name: 'meta+]',
            command: 'list.indent'
        },
        'ctrl+[, meta+[, shift+tab': {
            title: '## hotkeys.meta-outdent ##',
            name: 'meta+[',
            command: 'list.outdent'
        },
        'ctrl+k, meta+k': {
            title: '## hotkeys.meta-k ##',
            name: 'meta+k',
            command: 'link.popup'
        }
    },

    // private
    markerChar: '\ufeff',
    containers: {
        main: ['toolbox', 'editor', 'source', 'preview', 'statusbar'],
        toolbox: ['pathbar', 'toolbar']
    },
    modes: {
        'nocontainer': {
            toolbar: false,
            extrabar: false,
            pathbar: false,
            padding: '0'
        }
    },
    buttonsObj: {
        'ai-tools': {
            title: '## buttons.ai-tools ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M18 3C18.5523 3 19 3.44772 19 4C19 4.26522 19.1054 4.51957 19.2929 4.70711C19.4804 4.89464 19.7348 5 20 5C20.5523 5 21 5.44772 21 6C21 6.55228 20.5523 7 20 7C19.7348 7 19.4804 7.10536 19.2929 7.29289C19.1054 7.48043 19 7.73478 19 8C19 8.55228 18.5523 9 18 9C17.4477 9 17 8.55228 17 8C17 7.73478 16.8946 7.48043 16.7071 7.29289C16.5196 7.10536 16.2652 7 16 7C15.4477 7 15 6.55228 15 6C15 5.44772 15.4477 5 16 5C16.2652 5 16.5196 4.89464 16.7071 4.70711C16.8946 4.51957 17 4.26522 17 4C17 3.44772 17.4477 3 18 3ZM9 5C9.55228 5 10 5.44772 10 6C10 7.32608 10.5268 8.59785 11.4645 9.53553C12.4021 10.4732 13.6739 11 15 11C15.5523 11 16 11.4477 16 12C16 12.5523 15.5523 13 15 13C13.6739 13 12.4021 13.5268 11.4645 14.4645C10.5268 15.4021 10 16.6739 10 18C10 18.5523 9.55228 19 9 19C8.44772 19 8 18.5523 8 18C8 16.6739 7.47322 15.4021 6.53553 14.4645C5.59785 13.5268 4.32608 13 3 13C2.44772 13 2 12.5523 2 12C2 11.4477 2.44772 11 3 11C4.32608 11 5.59785 10.4732 6.53553 9.53553C7.47322 8.59785 8 7.32608 8 6C8 5.44772 8.44772 5 9 5ZM9 9.60559C8.70843 10.0908 8.35673 10.5428 7.94975 10.9497C7.54276 11.3567 7.09082 11.7084 6.60559 12C7.09082 12.2916 7.54276 12.6433 7.94975 13.0503C8.35673 13.4572 8.70843 13.9092 9 14.3944C9.29157 13.9092 9.64327 13.4572 10.0503 13.0503C10.4572 12.6433 10.9092 12.2916 11.3944 12C10.9092 11.7084 10.4572 11.3567 10.0503 10.9497C9.64327 10.5428 9.29157 10.0908 9 9.60559ZM16.7071 16.7071C16.8946 16.5196 17 16.2652 17 16C17 15.4477 17.4477 15 18 15C18.5523 15 19 15.4477 19 16C19 16.2652 19.1054 16.5196 19.2929 16.7071C19.4804 16.8946 19.7348 17 20 17C20.5523 17 21 17.4477 21 18C21 18.5523 20.5523 19 20 19C19.7348 19 19.4804 19.1054 19.2929 19.2929C19.1054 19.4804 19 19.7348 19 20C19 20.5523 18.5523 21 18 21C17.4477 21 17 20.5523 17 20C17 19.7348 16.8946 19.4804 16.7071 19.2929C16.5196 19.1054 16.2652 19 16 19C15.4477 19 15 18.5523 15 18C15 17.4477 15.4477 17 16 17C16.2652 17 16.5196 16.8946 16.7071 16.7071Z"/></svg>',
            observer: 'ai.observe',
            command: 'ai.popup'
        },
        'ai-prompt': {
            title: '## buttons.ai-tools ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M18 3C18.5523 3 19 3.44772 19 4C19 4.26522 19.1054 4.51957 19.2929 4.70711C19.4804 4.89464 19.7348 5 20 5C20.5523 5 21 5.44772 21 6C21 6.55228 20.5523 7 20 7C19.7348 7 19.4804 7.10536 19.2929 7.29289C19.1054 7.48043 19 7.73478 19 8C19 8.55228 18.5523 9 18 9C17.4477 9 17 8.55228 17 8C17 7.73478 16.8946 7.48043 16.7071 7.29289C16.5196 7.10536 16.2652 7 16 7C15.4477 7 15 6.55228 15 6C15 5.44772 15.4477 5 16 5C16.2652 5 16.5196 4.89464 16.7071 4.70711C16.8946 4.51957 17 4.26522 17 4C17 3.44772 17.4477 3 18 3ZM9 5C9.55228 5 10 5.44772 10 6C10 7.32608 10.5268 8.59785 11.4645 9.53553C12.4021 10.4732 13.6739 11 15 11C15.5523 11 16 11.4477 16 12C16 12.5523 15.5523 13 15 13C13.6739 13 12.4021 13.5268 11.4645 14.4645C10.5268 15.4021 10 16.6739 10 18C10 18.5523 9.55228 19 9 19C8.44772 19 8 18.5523 8 18C8 16.6739 7.47322 15.4021 6.53553 14.4645C5.59785 13.5268 4.32608 13 3 13C2.44772 13 2 12.5523 2 12C2 11.4477 2.44772 11 3 11C4.32608 11 5.59785 10.4732 6.53553 9.53553C7.47322 8.59785 8 7.32608 8 6C8 5.44772 8.44772 5 9 5ZM9 9.60559C8.70843 10.0908 8.35673 10.5428 7.94975 10.9497C7.54276 11.3567 7.09082 11.7084 6.60559 12C7.09082 12.2916 7.54276 12.6433 7.94975 13.0503C8.35673 13.4572 8.70843 13.9092 9 14.3944C9.29157 13.9092 9.64327 13.4572 10.0503 13.0503C10.4572 12.6433 10.9092 12.2916 11.3944 12C10.9092 11.7084 10.4572 11.3567 10.0503 10.9497C9.64327 10.5428 9.29157 10.0908 9 9.60559ZM16.7071 16.7071C16.8946 16.5196 17 16.2652 17 16C17 15.4477 17.4477 15 18 15C18.5523 15 19 15.4477 19 16C19 16.2652 19.1054 16.5196 19.2929 16.7071C19.4804 16.8946 19.7348 17 20 17C20.5523 17 21 17.4477 21 18C21 18.5523 20.5523 19 20 19C19.7348 19 19.4804 19.1054 19.2929 19.2929C19.1054 19.4804 19 19.7348 19 20C19 20.5523 18.5523 21 18 21C17.4477 21 17 20.5523 17 20C17 19.7348 16.8946 19.4804 16.7071 19.2929C16.5196 19.1054 16.2652 19 16 19C15.4477 19 15 18.5523 15 18C15 17.4477 15.4477 17 16 17C16.2652 17 16.5196 16.8946 16.7071 16.7071Z"/></svg>',
            observer: 'ai.observe',
            command: 'ai.popupPrompt'
        },
        'ai-image': {
            title: '## buttons.ai-image ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M18 3C18.5523 3 19 3.44772 19 4C19 4.26522 19.1054 4.51957 19.2929 4.70711C19.4804 4.89464 19.7348 5 20 5C20.5523 5 21 5.44772 21 6C21 6.55228 20.5523 7 20 7C19.7348 7 19.4804 7.10536 19.2929 7.29289C19.1054 7.48043 19 7.73478 19 8C19 8.55228 18.5523 9 18 9C17.4477 9 17 8.55228 17 8C17 7.73478 16.8946 7.48043 16.7071 7.29289C16.5196 7.10536 16.2652 7 16 7C15.4477 7 15 6.55228 15 6C15 5.44772 15.4477 5 16 5C16.2652 5 16.5196 4.89464 16.7071 4.70711C16.8946 4.51957 17 4.26522 17 4C17 3.44772 17.4477 3 18 3ZM9 5C9.55228 5 10 5.44772 10 6C10 7.32608 10.5268 8.59785 11.4645 9.53553C12.4021 10.4732 13.6739 11 15 11C15.5523 11 16 11.4477 16 12C16 12.5523 15.5523 13 15 13C13.6739 13 12.4021 13.5268 11.4645 14.4645C10.5268 15.4021 10 16.6739 10 18C10 18.5523 9.55228 19 9 19C8.44772 19 8 18.5523 8 18C8 16.6739 7.47322 15.4021 6.53553 14.4645C5.59785 13.5268 4.32608 13 3 13C2.44772 13 2 12.5523 2 12C2 11.4477 2.44772 11 3 11C4.32608 11 5.59785 10.4732 6.53553 9.53553C7.47322 8.59785 8 7.32608 8 6C8 5.44772 8.44772 5 9 5ZM9 9.60559C8.70843 10.0908 8.35673 10.5428 7.94975 10.9497C7.54276 11.3567 7.09082 11.7084 6.60559 12C7.09082 12.2916 7.54276 12.6433 7.94975 13.0503C8.35673 13.4572 8.70843 13.9092 9 14.3944C9.29157 13.9092 9.64327 13.4572 10.0503 13.0503C10.4572 12.6433 10.9092 12.2916 11.3944 12C10.9092 11.7084 10.4572 11.3567 10.0503 10.9497C9.64327 10.5428 9.29157 10.0908 9 9.60559ZM16.7071 16.7071C16.8946 16.5196 17 16.2652 17 16C17 15.4477 17.4477 15 18 15C18.5523 15 19 15.4477 19 16C19 16.2652 19.1054 16.5196 19.2929 16.7071C19.4804 16.8946 19.7348 17 20 17C20.5523 17 21 17.4477 21 18C21 18.5523 20.5523 19 20 19C19.7348 19 19.4804 19.1054 19.2929 19.2929C19.1054 19.4804 19 19.7348 19 20C19 20.5523 18.5523 21 18 21C17.4477 21 17 20.5523 17 20C17 19.7348 16.8946 19.4804 16.7071 19.2929C16.5196 19.1054 16.2652 19 16 19C15.4477 19 15 18.5523 15 18C15 17.4477 15.4477 17 16 17C16.2652 17 16.5196 16.8946 16.7071 16.7071Z"/></svg>',
            observer: 'ai.observe',
            command: 'ai.promptImage',
        },
        'add': {
            title: '## buttons.add ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M13 3.75C13 3.19772 12.5523 2.75 12 2.75C11.4477 2.75 11 3.19772 11 3.75V11H3.75C3.19772 11 2.75 11.4477 2.75 12C2.75 12.5523 3.19772 13 3.75 13H11V20.25C11 20.8023 11.4477 21.25 12 21.25C12.5523 21.25 13 20.8023 13 20.25V13H20.25C20.8023 13 21.25 12.5523 21.25 12C21.25 11.4477 20.8023 11 20.25 11H13V3.75Z"/></svg>',
            command: 'addbar.popup'
        },
        'html': {
            title: '## buttons.html ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.9701 4.24253C15.1041 3.70673 14.7783 3.1638 14.2425 3.02985C13.7067 2.8959 13.1638 3.22166 13.0299 3.75746L9.02986 19.7575C8.89591 20.2933 9.22167 20.8362 9.75746 20.9701C10.2933 21.1041 10.8362 20.7783 10.9701 20.2425L14.9701 4.24253ZM7.70711 7.29289C8.09763 7.68341 8.09763 8.31658 7.70711 8.7071L4.41421 12L7.70711 15.2929C8.09763 15.6834 8.09763 16.3166 7.70711 16.7071C7.31658 17.0976 6.68342 17.0976 6.29289 16.7071L2.29289 12.7071C1.90237 12.3166 1.90237 11.6834 2.29289 11.2929L6.29289 7.29289C6.68342 6.90236 7.31658 6.90236 7.70711 7.29289ZM16.2929 7.29289C16.6834 6.90236 17.3166 6.90236 17.7071 7.29289L21.7071 11.2929C22.0976 11.6834 22.0976 12.3166 21.7071 12.7071L17.7071 16.7071C17.3166 17.0976 16.6834 17.0976 16.2929 16.7071C15.9024 16.3166 15.9024 15.6834 16.2929 15.2929L19.5858 12L16.2929 8.7071C15.9024 8.31658 15.9024 7.68341 16.2929 7.29289Z"/></svg>',
            command: 'source.toggle'
        },
        'format': {
            title: '## buttons.format ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.32413 6.98804C6.14654 7.2864 6 7.75331 6 8.5C6 9.24669 6.14654 9.7136 6.32413 10.012C6.49608 10.3008 6.73889 10.5026 7.06782 10.6511C7.58542 10.8849 8.24184 10.9625 9 10.9879V6.01213C8.24184 6.03755 7.58542 6.11512 7.06782 6.34887C6.73889 6.49742 6.49608 6.69917 6.32413 6.98804ZM6.24464 12.4739C7.10428 12.8621 8.10853 12.9642 9 12.9908V19C9 19.5523 9.44772 20 10 20C10.5523 20 11 19.5523 11 19V12V6H15V19C15 19.5523 15.4477 20 16 20C16.5523 20 17 19.5523 17 19V6H18C18.5523 6 19 5.55228 19 5C19 4.44772 18.5523 4 18 4H16H15C14.9996 4 14.9993 4 14.9989 4L10 4L9.99773 4L9.90325 3.99997C8.84701 3.99946 7.4124 3.99876 6.24464 4.52613C5.60483 4.81508 5.01952 5.26959 4.60554 5.96509C4.1972 6.65111 4 7.49669 4 8.5C4 9.50331 4.1972 10.3489 4.60554 11.0349C5.01952 11.7304 5.60483 12.1849 6.24464 12.4739Z"/></svg>',
            command: 'format.popup'
        },
        'bold': {
            title: '## buttons.bold ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 4C6.44772 4 6 4.44772 6 5V12V19C6 19.5523 6.44772 20 7 20H14C15.1935 20 16.3381 19.5259 17.182 18.682C18.0259 17.8381 18.5 16.6935 18.5 15.5C18.5 14.3065 18.0259 13.1619 17.182 12.318C16.9031 12.0391 16.5914 11.8006 16.2559 11.6063C17.0535 10.7703 17.5 9.65816 17.5 8.5C17.5 7.30653 17.0259 6.16193 16.182 5.31802C15.3381 4.47411 14.1935 4 13 4H7ZM13 13H8V18H14C14.663 18 15.2989 17.7366 15.7678 17.2678C16.2366 16.7989 16.5 16.163 16.5 15.5C16.5 14.837 16.2366 14.2011 15.7678 13.7322C15.2989 13.2634 14.663 13 14 13H13ZM13 11C13.663 11 14.2989 10.7366 14.7678 10.2678C15.2366 9.79893 15.5 9.16304 15.5 8.5C15.5 7.83696 15.2366 7.20107 14.7678 6.73223C14.2989 6.26339 13.663 6 13 6H8V11H13Z"/></svg>',
            command: 'inline.set',
            params: { tag: 'b' }
        },
        'italic': {
            title: '## buttons.italic ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.0222 4H17C17.5523 4 18 4.44772 18 5C18 5.55228 17.5523 6 17 6H14.7543L11.3257 18H13C13.5523 18 14 18.4477 14 19C14 19.5523 13.5523 20 13 20H10.023C10.0081 20.0003 9.99304 20.0003 9.97798 20H7C6.44772 20 6 19.5523 6 19C6 18.4477 6.44772 18 7 18H9.24571L12.6743 6H11C10.4477 6 10 5.55228 10 5C10 4.44772 10.4477 4 11 4H13.9768C13.9919 3.99966 14.007 3.99965 14.0222 4Z"/></svg>',
            command: 'inline.set',
            params: { tag: 'i' }
        },
        'deleted': {
            title: '## buttons.deleted ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.8776 4.46266C14.0175 4.14012 13.0023 3.98493 11.9923 3.99999H11C9.80652 3.99999 8.66193 4.4741 7.81802 5.31801C6.9741 6.16193 6.5 7.30652 6.5 8.49999C6.5 9.39648 6.76751 10.2654 7.25832 11H5C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13H13.0058C13.6667 13.0015 14.3003 13.2647 14.7678 13.7322C15.2366 14.2011 15.5 14.837 15.5 15.5C15.5 16.163 15.2366 16.7989 14.7678 17.2678C14.2989 17.7366 13.663 18 13 18H11.5L11.4842 18.0001C10.6801 18.0128 9.9163 17.8865 9.32462 17.6647C8.70357 17.4318 8.45244 17.1652 8.38892 17.0419C8.13594 16.551 7.53288 16.3581 7.04194 16.6111C6.551 16.864 6.35809 17.4671 6.61107 17.9581C7.00105 18.7149 7.78931 19.2249 8.62237 19.5373C9.4825 19.8599 10.4977 20.0151 11.5077 20H13C14.1935 20 15.3381 19.5259 16.182 18.682C17.0259 17.8381 17.5 16.6935 17.5 15.5C17.5 14.6035 17.2325 13.7346 16.7417 13H19C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11H13.0083C13.0055 11 13.0028 11 13 11H11C10.337 11 9.70107 10.7366 9.23223 10.2678C8.76339 9.79892 8.5 9.16303 8.5 8.49999C8.5 7.83695 8.76339 7.20107 9.23223 6.73223C9.70107 6.26338 10.337 5.99999 11 5.99999H12L12.0158 5.99987C12.8199 5.98715 13.5837 6.11344 14.1754 6.33532C14.7964 6.56822 15.0476 6.83478 15.1111 6.95805C15.3641 7.44899 15.9671 7.64189 16.4581 7.38892C16.949 7.13594 17.1419 6.53287 16.8889 6.04193C16.4989 5.28513 15.7107 4.77506 14.8776 4.46266Z"/></svg>',
            command: 'inline.set',
            params: { tag: 'del' }
        },
        'moreinline': {
            title: '## buttons.more-formatting ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 12C3 10.8954 3.89543 10 5 10C6.10457 10 7 10.8954 7 12C7 13.1046 6.10457 14 5 14C3.89543 14 3 13.1046 3 12ZM10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12ZM19 10C17.8954 10 17 10.8954 17 12C17 13.1046 17.8954 14 19 14C20.1046 14 21 13.1046 21 12C21 10.8954 20.1046 10 19 10Z"/></svg>',
            command: 'inline.popup'
        },
        'link': {
            title: '## buttons.link ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.1946 6.14687L11.7568 6.65369C11.3957 7.07164 10.7643 7.11778 10.3463 6.75676C9.92836 6.39573 9.88222 5.76425 10.2432 5.34631L10.7062 4.81031C10.7222 4.79189 10.7387 4.77405 10.7559 4.75684C11.8813 3.63165 13.4075 2.99958 14.9989 2.99969C16.5903 2.99981 18.1165 3.63209 19.2417 4.75744C20.3669 5.8828 20.9989 7.40904 20.9988 9.00042C20.9987 10.5918 20.3664 12.118 19.2411 13.2432C19.2246 13.2596 19.2075 13.2756 19.1899 13.2909L18.6559 13.7549C18.239 14.1171 17.6074 14.0728 17.2452 13.6559C16.8829 13.239 16.9272 12.6074 17.3441 12.2452L17.8502 11.8054C18.5859 11.0576 18.9987 10.0502 18.9988 9.00028C18.9989 7.93934 18.5775 6.92181 17.8273 6.17156C17.0772 5.4213 16.0597 4.99977 14.9988 4.99969C13.9493 4.99962 12.9424 5.41192 12.1946 6.14687ZM15.7071 8.29289C16.0976 8.68342 16.0976 9.31658 15.7071 9.70711L9.70711 15.7071C9.31658 16.0976 8.68342 16.0976 8.29289 15.7071C7.90237 15.3166 7.90237 14.6834 8.29289 14.2929L14.2929 8.29289C14.6834 7.90237 15.3166 7.90237 15.7071 8.29289ZM6.7494 10.3379C7.11509 10.7517 7.07603 11.3837 6.66216 11.7494L6.16037 12.1928C5.7956 12.5583 5.50555 12.9915 5.30653 13.4681C5.10411 13.953 4.99988 14.4731 4.99988 14.9985C4.99988 15.5239 5.10411 16.044 5.30653 16.5289C5.50895 17.0137 5.80554 17.4535 6.17913 17.8229L6.17916 17.8229C6.9407 18.576 7.96851 18.9984 9.03952 18.9984C10.0866 18.9984 11.0923 18.5947 11.8483 17.873L12.1975 17.4034C12.527 16.9602 13.1534 16.868 13.5966 17.1975C14.0399 17.527 14.132 18.1534 13.8025 18.5966L13.4055 19.1306C13.3754 19.1712 13.3421 19.2095 13.3062 19.2451C12.1702 20.3684 10.6371 20.9984 9.03952 20.9984C7.44197 20.9984 5.90886 20.3684 4.77291 19.2451C4.21121 18.6897 3.76528 18.0284 3.46093 17.2994C3.15659 16.5705 2.99988 15.7884 2.99988 14.9985C2.99988 14.2086 3.15659 13.4265 3.46093 12.6976C3.76528 11.9686 4.21121 11.3073 4.77291 10.7519C4.78621 10.7388 4.79987 10.726 4.81388 10.7136L5.33788 10.2506C5.75175 9.88493 6.38371 9.92399 6.7494 10.3379Z"/></svg>',
            observer: 'link.observe',
            command: 'link.popup'
        },
        'link-text': {
            title: '## buttons.link-text ##',
            command: 'link.open'
        },
        'unlink': {
            title: '## buttons.unlink ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 1C7.55228 1 8 1.44772 8 2V4C8 4.55228 7.55228 5 7 5C6.44772 5 6 4.55228 6 4V2C6 1.44772 6.44772 1 7 1ZM12.1946 6.14687L11.7568 6.65369C11.3957 7.07164 10.7643 7.11778 10.3463 6.75676C9.92836 6.39573 9.88222 5.76425 10.2432 5.34631L10.7062 4.81031C10.7222 4.79189 10.7387 4.77405 10.7559 4.75684C11.8813 3.63165 13.4075 2.99958 14.9989 2.99969C16.5903 2.99981 18.1165 3.63209 19.2417 4.75744C20.3669 5.8828 20.9989 7.40905 20.9988 9.00043C20.9987 10.5918 20.3664 12.118 19.2411 13.2432C19.2246 13.2596 19.2075 13.2756 19.1899 13.2909L18.6559 13.7549C18.239 14.1171 17.6074 14.0728 17.2452 13.6559C16.8829 13.239 16.9272 12.6074 17.3441 12.2452L17.8502 11.8054C18.5859 11.0576 18.9987 10.0502 18.9988 9.00028C18.9989 7.93934 18.5775 6.92181 17.8273 6.17156C17.0772 5.4213 16.0597 4.99977 14.9988 4.99969C13.9493 4.99962 12.9424 5.41192 12.1946 6.14687ZM1 7C1 6.44772 1.44772 6 2 6H4C4.55228 6 5 6.44772 5 7C5 7.55228 4.55228 8 4 8H2C1.44772 8 1 7.55228 1 7ZM15.7071 8.29289C16.0976 8.68342 16.0976 9.31658 15.7071 9.70711L9.70711 15.7071C9.31658 16.0976 8.68342 16.0976 8.29289 15.7071C7.90237 15.3166 7.90237 14.6834 8.29289 14.2929L14.2929 8.29289C14.6834 7.90237 15.3166 7.90237 15.7071 8.29289ZM6.7494 10.3379C7.11509 10.7517 7.07603 11.3837 6.66216 11.7494L6.16037 12.1928C5.7956 12.5583 5.50555 12.9915 5.30653 13.4681C5.10411 13.953 4.99988 14.4731 4.99988 14.9985C4.99988 15.5239 5.10411 16.044 5.30653 16.5289C5.50895 17.0137 5.80554 17.4535 6.17913 17.8229L6.17916 17.8229C6.9407 18.576 7.96851 18.9984 9.03952 18.9984C10.0866 18.9984 11.0923 18.5947 11.8483 17.873L12.1975 17.4034C12.527 16.9602 13.1534 16.868 13.5966 17.1975C14.0399 17.527 14.132 18.1534 13.8025 18.5966L13.4055 19.1306C13.3754 19.1712 13.3421 19.2095 13.3062 19.2451C12.1702 20.3684 10.6371 20.9984 9.03952 20.9984C7.44197 20.9984 5.90886 20.3684 4.77291 19.2451C4.21121 18.6897 3.76528 18.0284 3.46093 17.2994C3.15659 16.5705 2.99988 15.7884 2.99988 14.9985C2.99988 14.2086 3.15659 13.4265 3.46093 12.6976C3.76528 11.9686 4.21121 11.3073 4.77291 10.7519C4.78621 10.7388 4.79987 10.726 4.81388 10.7136L5.33788 10.2506C5.75175 9.88493 6.38371 9.92399 6.7494 10.3379ZM19 17C19 16.4477 19.4477 16 20 16H22C22.5523 16 23 16.4477 23 17C23 17.5523 22.5523 18 22 18H20C19.4477 18 19 17.5523 19 17ZM17 19C17.5523 19 18 19.4477 18 20V22C18 22.5523 17.5523 23 17 23C16.4477 23 16 22.5523 16 22V20C16 19.4477 16.4477 19 17 19Z"/></svg>',
            command: 'link.unlink'
        },
        'image': {
            title: '## buttons.image ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M5 7C5 5.89543 5.89543 5 7 5H17C18.1046 5 19 5.89543 19 7V12.5858L18.7071 12.2929L18.6934 12.2794C18.091 11.6998 17.3358 11.3301 16.5 11.3301C15.6642 11.3301 14.909 11.6998 14.3066 12.2794L14.2929 12.2929L14 12.5858L11.7071 10.2929L11.6934 10.2794C11.091 9.6998 10.3358 9.33014 9.5 9.33014C8.66419 9.33014 7.909 9.6998 7.30662 10.2794L7.29289 10.2929L5 12.5858V7ZM15.4142 14L15.6997 13.7146C16.0069 13.4213 16.2841 13.3301 16.5 13.3301C16.7159 13.3301 16.9931 13.4213 17.3003 13.7146L19 15.4142V17C19 18.1046 18.1046 19 17 19H7C5.89543 19 5 18.1046 5 17V15.4142L8.69966 11.7146C9.0069 11.4213 9.28406 11.3301 9.5 11.3301C9.71594 11.3301 9.9931 11.4213 10.3003 11.7146L13.2929 14.7071L15.2929 16.7071C15.6834 17.0976 16.3166 17.0976 16.7071 16.7071C17.0976 16.3166 17.0976 15.6834 16.7071 15.2929L15.4142 14ZM21 15.001V17C21 19.2091 19.2091 21 17 21H7C4.79086 21 3 19.2091 3 17V15.0002V14.9998V7C3 4.79086 4.79086 3 7 3H17C19.2091 3 21 4.79086 21 7V14.999C21 14.9997 21 15.0003 21 15.001ZM15 7C14.4477 7 14 7.44772 14 8C14 8.55228 14.4477 9 15 9H15.01C15.5623 9 16.01 8.55228 16.01 8C16.01 7.44772 15.5623 7 15.01 7H15Z"/></svg>',
            observer: 'image.observe',
            command: 'image.popup'
        },
        'unwrap': {
            title: '## buttons.unwrap ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M2.29289 2.29289C2.68342 1.90237 3.31658 1.90237 3.70711 2.29289L21.7071 20.2929C22.0976 20.6834 22.0976 21.3166 21.7071 21.7071C21.3166 22.0976 20.6834 22.0976 20.2929 21.7071L18 19.4142V20C18 20.5523 17.5523 21 17 21C16.4477 21 16 20.5523 16 20V18H8V20C8 20.5523 7.55228 21 7 21C6.44772 21 6 20.5523 6 20V18H4C3.44772 18 3 17.5523 3 17C3 16.4477 3.44772 16 4 16H6V8H4C3.44772 8 3 7.55228 3 7C3 6.44772 3.44772 6 4 6H4.58579L2.29289 3.70711C1.90237 3.31658 1.90237 2.68342 2.29289 2.29289ZM8 9.41421L14.5858 16H8V9.41421ZM17 3C17.5523 3 18 3.44772 18 4V6H20C20.5523 6 21 6.44772 21 7C21 7.55228 20.5523 8 20 8H18V13C18 13.5523 17.5523 14 17 14C16.4477 14 16 13.5523 16 13V8H11C10.4477 8 10 7.55228 10 7C10 6.44772 10.4477 6 11 6H16V4C16 3.44772 16.4477 3 17 3Z"/></svg>',
            command: 'block.unwrap'
        },
        'outset': {
            title: '## buttons.outset ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 4C6 3.44772 6.44772 3 7 3H17C17.5523 3 18 3.44772 18 4C18 4.55229 17.5523 5 17 5L7 5C6.44772 5 6 4.55228 6 4ZM3.58579 7.58579C3.96086 7.21071 4.46957 7 5 7H19C19.5304 7 20.0391 7.21071 20.4142 7.58579C20.7893 7.96086 21 8.46957 21 9V15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H5C4.46957 17 3.96086 16.7893 3.58579 16.4142C3.21071 16.0391 3 15.5304 3 15V9C3 8.46957 3.21071 7.96086 3.58579 7.58579ZM19 9H5L5 15H19V9ZM7 19C6.44772 19 6 19.4477 6 20C6 20.5523 6.44772 21 7 21H17C17.5523 21 18 20.5523 18 20C18 19.4477 17.5523 19 17 19H7Z"/></svg>',
            observer: 'image.observe',
            command: 'image.popupOutset'
        },
        'wrap': {
            title: '## buttons.wrap-image ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.58579 4.58579C3.96086 4.21071 4.46957 4 5 4H9C9.53043 4 10.0391 4.21071 10.4142 4.58579C10.7893 4.96086 11 5.46957 11 6V10C11 10.5304 10.7893 11.0391 10.4142 11.4142C10.0391 11.7893 9.53043 12 9 12H5C4.46957 12 3.96086 11.7893 3.58579 11.4142C3.21071 11.0391 3 10.5304 3 10V6C3 5.46957 3.21071 4.96086 3.58579 4.58579ZM9 6L5 6L5 10H9V6ZM13 7C13 6.44772 13.4477 6 14 6H20C20.5523 6 21 6.44772 21 7C21 7.55228 20.5523 8 20 8H14C13.4477 8 13 7.55228 13 7ZM13 11C13 10.4477 13.4477 10 14 10H20C20.5523 10 21 10.4477 21 11C21 11.5523 20.5523 12 20 12H14C13.4477 12 13 11.5523 13 11ZM3 15C3 14.4477 3.44772 14 4 14H20C20.5523 14 21 14.4477 21 15C21 15.5523 20.5523 16 20 16H4C3.44772 16 3 15.5523 3 15ZM3 19C3 18.4477 3.44772 18 4 18H20C20.5523 18 21 18.4477 21 19C21 19.5523 20.5523 20 20 20H4C3.44772 20 3 19.5523 3 19Z"/></svg>',
            observer: 'image.observe',
            command: 'image.popupWrap'
        },
        'move-up': {
            title: '## buttons.move-up ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.2929 4.29289C11.6834 3.90237 12.3166 3.90237 12.7071 4.29289L16.7071 8.29289C17.0976 8.68342 17.0976 9.31658 16.7071 9.70711C16.3166 10.0976 15.6834 10.0976 15.2929 9.70711L13 7.41421V19C13 19.5523 12.5523 20 12 20C11.4477 20 11 19.5523 11 19V7.41421L8.70711 9.70711C8.31658 10.0976 7.68342 10.0976 7.29289 9.70711C6.90237 9.31658 6.90237 8.68342 7.29289 8.29289L11.2929 4.29289Z"/></svg>',
            command: 'block.moveUp'
        },
        'move-down': {
            title: '## buttons.move-down ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 4C12.5523 4 13 4.44772 13 5V16.5858L15.2929 14.2929C15.6834 13.9024 16.3166 13.9024 16.7071 14.2929C17.0976 14.6834 17.0976 15.3166 16.7071 15.7071L12.7071 19.7071C12.3166 20.0976 11.6834 20.0976 11.2929 19.7071L7.29289 15.7071C6.90237 15.3166 6.90237 14.6834 7.29289 14.2929C7.68342 13.9024 8.31658 13.9024 8.70711 14.2929L11 16.5858V5C11 4.44772 11.4477 4 12 4Z"/></svg>',
            command: 'block.moveDown'
        },
        'list': {
            title: '## buttons.list ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 6C6 5.44772 5.55228 5 5 5C4.44772 5 4 5.44772 4 6V6.01C4 6.56228 4.44772 7.01 5 7.01C5.55228 7.01 6 6.56228 6 6.01V6ZM9 5C8.44772 5 8 5.44772 8 6C8 6.55228 8.44772 7 9 7H20C20.5523 7 21 6.55228 21 6C21 5.44772 20.5523 5 20 5H9ZM9 11C8.44772 11 8 11.4477 8 12C8 12.5523 8.44772 13 9 13H20C20.5523 13 21 12.5523 21 12C21 11.4477 20.5523 11 20 11H9ZM8 18C8 17.4477 8.44772 17 9 17H20C20.5523 17 21 17.4477 21 18C21 18.5523 20.5523 19 20 19H9C8.44772 19 8 18.5523 8 18ZM5 11C5.55228 11 6 11.4477 6 12V12.01C6 12.5623 5.55228 13.01 5 13.01C4.44772 13.01 4 12.5623 4 12.01V12C4 11.4477 4.44772 11 5 11ZM6 18C6 17.4477 5.55228 17 5 17C4.44772 17 4 17.4477 4 18V18.01C4 18.5623 4.44772 19.01 5 19.01C5.55228 19.01 6 18.5623 6 18.01V18Z"/></svg>',
            command: 'list.popup'
        },
        'numberedlist': {
            title: '## buttons.numbered-list ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.38267 3.07612C6.75635 3.2309 6.99999 3.59554 6.99999 4V10C6.99999 10.5523 6.55227 11 5.99999 11C5.44771 11 4.99999 10.5523 4.99999 10V6.41421L4.7071 6.70711C4.31657 7.09763 3.68341 7.09763 3.29288 6.70711C2.90236 6.31658 2.90236 5.68342 3.29288 5.29289L5.29288 3.29289C5.57888 3.00689 6.009 2.92134 6.38267 3.07612ZM9.99999 6C9.99999 5.44771 10.4477 5 11 5H20C20.5523 5 21 5.44771 21 6C21 6.55228 20.5523 7 20 7H11C10.4477 7 9.99999 6.55228 9.99999 6ZM9.99999 12C9.99999 11.4477 10.4477 11 11 11H20C20.5523 11 21 11.4477 21 12C21 12.5523 20.5523 13 20 13H11C10.4477 13 9.99999 12.5523 9.99999 12ZM5.99999 15C5.73477 15 5.48042 15.1054 5.29288 15.2929C5.10535 15.4804 4.99999 15.7348 4.99999 16C4.99999 16.5523 4.55227 17 3.99999 17C3.44771 17 2.99999 16.5523 2.99999 16C2.99999 15.2043 3.31606 14.4413 3.87867 13.8787C4.44128 13.3161 5.20434 13 5.99999 13C6.79564 13 7.5587 13.3161 8.12131 13.8787C8.68392 14.4413 8.99999 15.2043 8.99999 16C8.99999 16.6051 8.73548 17.0689 8.47379 17.402C8.28592 17.6411 8.03874 17.8824 7.84515 18.0714C7.79485 18.1205 7.74818 18.166 7.7071 18.2071C7.68572 18.2285 7.66339 18.2489 7.64017 18.2682L6.76204 19H7.99999C8.55228 19 8.99999 19.4477 8.99999 20C8.99999 20.5523 8.55228 21 7.99999 21H3.99999C3.57897 21 3.20304 20.7363 3.05972 20.3404C2.91639 19.9445 3.03637 19.5013 3.35981 19.2318L6.32564 16.7602C6.37812 16.7081 6.42975 16.6576 6.47777 16.6106L6.4872 16.6014C6.54925 16.5407 6.605 16.4861 6.65796 16.4328C6.76524 16.3249 6.84297 16.2404 6.90119 16.1663C6.95852 16.0933 6.98291 16.0478 6.99308 16.0238C7.00043 16.0064 7.00009 16.0014 7 16.0002C7 16.0001 6.99999 16.0001 6.99999 16C6.99999 15.7348 6.89463 15.4804 6.7071 15.2929C6.51956 15.1054 6.26521 15 5.99999 15ZM11 18C11 17.4477 11.4477 17 12 17H20C20.5523 17 21 17.4477 21 18C21 18.5523 20.5523 19 20 19H12C11.4477 19 11 18.5523 11 18Z"/></svg>',
            command: 'format.set'
        },
        'bulletlist': {
            title: '## buttons.bullet-list ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 6C6 5.44772 5.55228 5 5 5C4.44772 5 4 5.44772 4 6V6.01C4 6.56228 4.44772 7.01 5 7.01C5.55228 7.01 6 6.56228 6 6.01V6ZM9 5C8.44772 5 8 5.44772 8 6C8 6.55228 8.44772 7 9 7H20C20.5523 7 21 6.55228 21 6C21 5.44772 20.5523 5 20 5H9ZM9 11C8.44772 11 8 11.4477 8 12C8 12.5523 8.44772 13 9 13H20C20.5523 13 21 12.5523 21 12C21 11.4477 20.5523 11 20 11H9ZM8 18C8 17.4477 8.44772 17 9 17H20C20.5523 17 21 17.4477 21 18C21 18.5523 20.5523 19 20 19H9C8.44772 19 8 18.5523 8 18ZM5 11C5.55228 11 6 11.4477 6 12V12.01C6 12.5623 5.55228 13.01 5 13.01C4.44772 13.01 4 12.5623 4 12.01V12C4 11.4477 4.44772 11 5 11ZM6 18C6 17.4477 5.55228 17 5 17C4.44772 17 4 17.4477 4 18V18.01C4 18.5623 4.44772 19.01 5 19.01C5.55228 19.01 6 18.5623 6 18.01V18Z"/></svg>',
            command: 'format.set'
        },
        'indent': {
            title: '## buttons.indent ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 6C8 5.44772 8.44772 5 9 5H20C20.5523 5 21 5.44772 21 6C21 6.55228 20.5523 7 20 7H9C8.44772 7 8 6.55228 8 6ZM3.29289 7.29289C3.68342 6.90237 4.31658 6.90237 4.70711 7.29289L8.70711 11.2929C9.09763 11.6834 9.09763 12.3166 8.70711 12.7071L4.70711 16.7071C4.31658 17.0976 3.68342 17.0976 3.29289 16.7071C2.90237 16.3166 2.90237 15.6834 3.29289 15.2929L6.58579 12L3.29289 8.70711C2.90237 8.31658 2.90237 7.68342 3.29289 7.29289ZM13 11H20C20.5523 11 21 11.4477 21 12C21 12.5523 20.5523 13 20 13H13C12.4477 13 12 12.5523 12 12C12 11.4477 12.4477 11 13 11ZM8 18C8 17.4477 8.44772 17 9 17H20C20.5523 17 21 17.4477 21 18C21 18.5523 20.5523 19 20 19H9C8.44772 19 8 18.5523 8 18Z"/></svg>',
            command: 'list.indent'
        },
        'outdent': {
            title: '## buttons.outdent ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 6C12 5.44772 12.4477 5 13 5H20C20.5523 5 21 5.44772 21 6C21 6.55228 20.5523 7 20 7H13C12.4477 7 12 6.55228 12 6ZM8.70711 7.29289C9.09763 7.68342 9.09763 8.31658 8.70711 8.70711L5.41421 12L8.70711 15.2929C9.09763 15.6834 9.09763 16.3166 8.70711 16.7071C8.31658 17.0976 7.68342 17.0976 7.29289 16.7071L3.29289 12.7071C2.90237 12.3166 2.90237 11.6834 3.29289 11.2929L7.29289 7.29289C7.68342 6.90237 8.31658 6.90237 8.70711 7.29289ZM10 12C10 11.4477 10.4477 11 11 11H20C20.5523 11 21 11.4477 21 12C21 12.5523 20.5523 13 20 13H11C10.4477 13 10 12.5523 10 12ZM12 18C12 17.4477 12.4477 17 13 17H20C20.5523 17 21 17.4477 21 18C21 18.5523 20.5523 19 20 19H13C12.4477 19 12 18.5523 12 18Z"/></svg>',
            command: 'list.outdent'
        },
        'dlist': {
            title: '## buttons.definition-list ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.5 5C5.36739 5 5.24021 5.05268 5.14645 5.14645C5.05268 5.24021 5 5.36739 5 5.5V7H6V5.5C6 5.36739 5.94732 5.24021 5.85355 5.14645C5.75979 5.05268 5.63261 5 5.5 5ZM8 5.5C8 4.83696 7.73661 4.20107 7.26777 3.73223C6.79893 3.26339 6.16304 3 5.5 3C4.83696 3 4.20107 3.26339 3.73223 3.73223C3.26339 4.20107 3 4.83696 3 5.5V10C3 10.5523 3.44772 11 4 11C4.55228 11 5 10.5523 5 10V9H6V10C6 10.5523 6.44772 11 7 11C7.55228 11 8 10.5523 8 10V5.5ZM10 6C10 5.44772 10.4477 5 11 5H20C20.5523 5 21 5.44772 21 6C21 6.55228 20.5523 7 20 7H11C10.4477 7 10 6.55228 10 6ZM10 12C10 11.4477 10.4477 11 11 11H20C20.5523 11 21 11.4477 21 12C21 12.5523 20.5523 13 20 13H11C10.4477 13 10 12.5523 10 12ZM3 14C3 13.4477 3.44772 13 4 13H5.5C6.16304 13 6.79893 13.2634 7.26777 13.7322C7.73661 14.2011 8 14.837 8 15.5C8 16.044 7.82267 16.5698 7.50001 17C7.82267 17.4302 8 17.956 8 18.5C8 19.163 7.73661 19.7989 7.26777 20.2678C6.79893 20.7366 6.16304 21 5.5 21H4C3.44772 21 3 20.5523 3 20V14ZM5 18V19H5.5C5.63261 19 5.75978 18.9473 5.85355 18.8536C5.94732 18.7598 6 18.6326 6 18.5C6 18.3674 5.94732 18.2402 5.85355 18.1464C5.75978 18.0527 5.63261 18 5.5 18H5ZM5.5 16C5.63261 16 5.75978 15.9473 5.85355 15.8536C5.94732 15.7598 6 15.6326 6 15.5C6 15.3674 5.94732 15.2402 5.85355 15.1464C5.75979 15.0527 5.63261 15 5.5 15H5V16H5.5ZM10 18C10 17.4477 10.4477 17 11 17H20C20.5523 17 21 17.4477 21 18C21 18.5523 20.5523 19 20 19H11C10.4477 19 10 18.5523 10 18Z"/></svg>',
            command: 'block.add'
        },
        'hotkeys': {
            title: '## buttons.hotkeys ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 8C3 7.44772 3.44772 7 4 7H20C20.5523 7 21 7.44772 21 8V16C21 16.5523 20.5523 17 20 17H4C3.44772 17 3 16.5523 3 16V8ZM4 5C2.34315 5 1 6.34315 1 8V16C1 17.6569 2.34315 19 4 19H20C21.6569 19 23 17.6569 23 16V8C23 6.34315 21.6569 5 20 5H4ZM7 14C7 13.4477 6.55228 13 6 13C5.44772 13 5 13.4477 5 14V14.01C5 14.5623 5.44772 15.01 6 15.01C6.55228 15.01 7 14.5623 7 14.01V14ZM6 9C6.55228 9 7 9.44772 7 10V10.01C7 10.5623 6.55228 11.01 6 11.01C5.44772 11.01 5 10.5623 5 10.01V10C5 9.44772 5.44772 9 6 9ZM11 10C11 9.44772 10.5523 9 10 9C9.44771 9 9 9.44772 9 10V10.01C9 10.5623 9.44771 11.01 10 11.01C10.5523 11.01 11 10.5623 11 10.01V10ZM14 9C14.5523 9 15 9.44772 15 10V10.01C15 10.5623 14.5523 11.01 14 11.01C13.4477 11.01 13 10.5623 13 10.01V10C13 9.44772 13.4477 9 14 9ZM19 10C19 9.44772 18.5523 9 18 9C17.4477 9 17 9.44772 17 10V10.01C17 10.5623 17.4477 11.01 18 11.01C18.5523 11.01 19 10.5623 19 10.01V10ZM18 13C18.5523 13 19 13.4477 19 14V14.01C19 14.5623 18.5523 15.01 18 15.01C17.4477 15.01 17 14.5623 17 14.01V14C17 13.4477 17.4477 13 18 13ZM10 13C9.44771 13 9 13.4477 9 14C9 14.5523 9.44771 15 10 15H14C14.5523 15 15 14.5523 15 14C15 13.4477 14.5523 13 14 13H10Z"/></svg>',
            command: 'hotkeys.popup'
        },
        'undo': {
            title: '## buttons.undo ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.70711 4.29289C10.0976 4.68342 10.0976 5.31658 9.70711 5.70711L7.41421 8H16C17.3261 8 18.5979 8.52678 19.5355 9.46447C20.4732 10.4021 21 11.6739 21 13C21 14.3261 20.4732 15.5979 19.5355 16.5355C18.5979 17.4732 17.3261 18 16 18H15C14.4477 18 14 17.5523 14 17C14 16.4477 14.4477 16 15 16H16C16.7956 16 17.5587 15.6839 18.1213 15.1213C18.6839 14.5587 19 13.7956 19 13C19 12.2044 18.6839 11.4413 18.1213 10.8787C17.5587 10.3161 16.7956 10 16 10H7.41421L9.70711 12.2929C10.0976 12.6834 10.0976 13.3166 9.70711 13.7071C9.31658 14.0976 8.68342 14.0976 8.29289 13.7071L4.29329 9.7075C4.29316 9.70737 4.29303 9.70724 4.29289 9.70711C4.29219 9.7064 4.29148 9.70569 4.29078 9.70498C4.19595 9.6096 4.12432 9.49986 4.07588 9.38278C4.02699 9.26488 4 9.13559 4 9C4 8.86441 4.02699 8.73512 4.07588 8.61722C4.12468 8.49927 4.19702 8.38877 4.29289 8.29289L8.29289 4.29289C8.68342 3.90237 9.31658 3.90237 9.70711 4.29289Z"/></svg>',
            command: 'state.undo'
        },
        'redo': {
            title: '## buttons.redo ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.2929 4.29289C14.9024 4.68342 14.9024 5.31658 15.2929 5.70711L17.5858 8H9C7.67392 8 6.40215 8.52678 5.46447 9.46447C4.52678 10.4021 4 11.6739 4 13C4 14.3261 4.52678 15.5979 5.46447 16.5355C6.40215 17.4732 7.67392 18 9 18H10C10.5523 18 11 17.5523 11 17C11 16.4477 10.5523 16 10 16H9C8.20435 16 7.44129 15.6839 6.87868 15.1213C6.31607 14.5587 6 13.7956 6 13C6 12.2044 6.31607 11.4413 6.87868 10.8787C7.44129 10.3161 8.20435 10 9 10H17.5858L15.2929 12.2929C14.9024 12.6834 14.9024 13.3166 15.2929 13.7071C15.6834 14.0976 16.3166 14.0976 16.7071 13.7071L20.7067 9.7075C20.7068 9.70737 20.707 9.70724 20.7071 9.70711C20.7078 9.7064 20.7085 9.70569 20.7092 9.70498C20.804 9.6096 20.8757 9.49986 20.9241 9.38278C20.973 9.26488 21 9.13559 21 9C21 8.86441 20.973 8.73512 20.9241 8.61722C20.8753 8.49927 20.803 8.38877 20.7071 8.29289L16.7071 4.29289C16.3166 3.90237 15.6834 3.90237 15.2929 4.29289Z"/></svg>',
            command: 'state.redo'
        },
        'toggle': {
            title: '## buttons.toggle ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M4 7C3.44772 7 3 7.44772 3 8C3 8.55228 3.44772 9 4 9H20C20.5523 9 21 8.55228 21 8C21 7.44772 20.5523 7 20 7H4ZM4 15C3.44772 15 3 15.4477 3 16C3 16.5523 3.44772 17 4 17H20C20.5523 17 21 16.5523 21 16C21 15.4477 20.5523 15 20 15H4Z"/></svg>',
            command: 'control.popup'
        },
        'duplicate': {
            title: '## buttons.duplicate ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 3C5.20435 3 4.44129 3.31607 3.87868 3.87868C3.31607 4.44129 3 5.20435 3 6V14C3 14.7956 3.31607 15.5587 3.87868 16.1213C4.44129 16.6839 5.20435 17 6 17H7V18C7 19.6569 8.34315 21 10 21H18C19.6569 21 21 19.6569 21 18V10C21 8.34315 19.6569 7 18 7H17V6C17 5.20435 16.6839 4.44129 16.1213 3.87868C15.5587 3.31607 14.7956 3 14 3H6ZM15 7V6C15 5.73478 14.8946 5.48043 14.7071 5.29289C14.5196 5.10536 14.2652 5 14 5H6C5.73478 5 5.48043 5.10536 5.29289 5.29289C5.10536 5.48043 5 5.73478 5 6V14C5 14.2652 5.10536 14.5196 5.29289 14.7071C5.48043 14.8946 5.73478 15 6 15H7V10C7 8.34315 8.34315 7 10 7H15ZM9 16V18C9 18.5523 9.44772 19 10 19H18C18.5523 19 19 18.5523 19 18V10C19 9.44772 18.5523 9 18 9H16H10C9.44772 9 9 9.44772 9 10V16Z"/></svg>',
            command: 'block.duplicate'
        },
        'trash': {
            title: '## buttons.delete ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10 2C9.46957 2 8.96086 2.21071 8.58579 2.58579C8.21071 2.96086 8 3.46957 8 4V6H5.01218H4.99004H4C3.44772 6 3 6.44772 3 7C3 7.55229 3.44772 8 4 8H4.07986L5.00034 19.0458C5.01222 19.8249 5.32687 20.5695 5.87867 21.1213C6.44128 21.6839 7.20434 22 7.99999 22H16C16.7956 22 17.5587 21.6839 18.1213 21.1213C18.6731 20.5695 18.9878 19.8249 18.9996 19.0458L19.9201 8H20C20.5523 8 21 7.55229 21 7C21 6.44772 20.5523 6 20 6H19.0099H18.9878H16V4C16 3.46957 15.7893 2.96086 15.4142 2.58579C15.0391 2.21071 14.5304 2 14 2H10ZM14 6V4L10 4L10 6H14ZM9 8H6.08679L6.99654 18.9169C6.99884 18.9446 6.99999 18.9723 6.99999 19C6.99999 19.2652 7.10535 19.5196 7.29289 19.7071C7.48042 19.8946 7.73478 20 7.99999 20H16C16.2652 20 16.5196 19.8946 16.7071 19.7071C16.8946 19.5196 17 19.2652 17 19C17 18.9723 17.0011 18.9446 17.0034 18.9169L17.9132 8H15H9ZM10 10C10.5523 10 11 10.4477 11 11V17C11 17.5523 10.5523 18 10 18C9.44772 18 9 17.5523 9 17V11C9 10.4477 9.44772 10 10 10ZM15 11C15 10.4477 14.5523 10 14 10C13.4477 10 13 10.4477 13 11V17C13 17.5523 13.4477 18 14 18C14.5523 18 15 17.5523 15 17V11Z"/></svg>',
            danger: true,
            command: 'block.remove'
        },
        'table': {
            title: '## buttons.table ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M5 4C4.73478 4 4.48043 4.10536 4.29289 4.29289C4.10536 4.48043 4 4.73478 4 5V9H9V4H5ZM5 2C4.20435 2 3.44129 2.31607 2.87868 2.87868C2.31607 3.44129 2 4.20435 2 5V19C2 19.7957 2.31607 20.5587 2.87868 21.1213C3.44129 21.6839 4.20435 22 5 22H19C19.7957 22 20.5587 21.6839 21.1213 21.1213C21.6839 20.5587 22 19.7957 22 19V5C22 4.20435 21.6839 3.44129 21.1213 2.87868C20.5587 2.31607 19.7957 2 19 2H5ZM11 4V9H20V5C20 4.73478 19.8946 4.48043 19.7071 4.29289C19.5196 4.10536 19.2652 4 19 4H11ZM20 11H11V20H19C19.2652 20 19.5196 19.8946 19.7071 19.7071C19.8946 19.5196 20 19.2652 20 19V11ZM9 20V11H4V19C4 19.2652 4.10536 19.5196 4.29289 19.7071C4.48043 19.8946 4.73478 20 5 20H9Z"/></svg>',
            observer: 'table.observe',
            command: 'block.add'
        },
        'cell-setting': {
            title: '## table.cell-setting ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 3C6.55228 3 7 3.44772 7 4V7.17157C7.4179 7.31933 7.80192 7.55928 8.12132 7.87868C8.68393 8.44129 9 9.20435 9 10C9 10.7956 8.68393 11.5587 8.12132 12.1213C7.80192 12.4407 7.4179 12.6807 7 12.8284V20C7 20.5523 6.55228 21 6 21C5.44772 21 5 20.5523 5 20V12.8284C4.5821 12.6807 4.19808 12.4407 3.87868 12.1213C3.31607 11.5587 3 10.7956 3 10C3 9.20435 3.31607 8.44129 3.87868 7.87868C4.19808 7.55928 4.5821 7.31933 5 7.17157V4C5 3.44772 5.44772 3 6 3ZM12 3C12.5523 3 13 3.44772 13 4V13.1716C13.4179 13.3193 13.8019 13.5593 14.1213 13.8787C14.6839 14.4413 15 15.2043 15 16C15 16.7957 14.6839 17.5587 14.1213 18.1213C13.8019 18.4407 13.4179 18.6807 13 18.8284V20C13 20.5523 12.5523 21 12 21C11.4477 21 11 20.5523 11 20V18.8284C10.5821 18.6807 10.1981 18.4407 9.87868 18.1213C9.31607 17.5587 9 16.7957 9 16C9 15.2043 9.31607 14.4413 9.87868 13.8787C10.1981 13.5593 10.5821 13.3193 11 13.1716V4C11 3.44772 11.4477 3 12 3ZM18 3C18.5523 3 19 3.44772 19 4V4.17157C19.4179 4.31933 19.8019 4.55927 20.1213 4.87868C20.6839 5.44129 21 6.20435 21 7C21 7.79565 20.6839 8.55871 20.1213 9.12132C19.8019 9.44072 19.4179 9.68067 19 9.82843V20C19 20.5523 18.5523 21 18 21C17.4477 21 17 20.5523 17 20V9.82843C16.5821 9.68067 16.1981 9.44072 15.8787 9.12132C15.3161 8.55871 15 7.79565 15 7C15 6.20435 15.3161 5.44129 15.8787 4.87868C16.1981 4.55927 16.5821 4.31933 17 4.17157V4C17 3.44772 17.4477 3 18 3ZM18 6C17.7348 6 17.4804 6.10536 17.2929 6.29289C17.1054 6.48043 17 6.73478 17 7C17 7.26522 17.1054 7.51957 17.2929 7.70711C17.4804 7.89464 17.7348 8 18 8C18.2652 8 18.5196 7.89464 18.7071 7.70711C18.8946 7.51957 19 7.26522 19 7C19 6.73478 18.8946 6.48043 18.7071 6.29289C18.5196 6.10536 18.2652 6 18 6ZM6 9C5.73478 9 5.48043 9.10536 5.29289 9.29289C5.10536 9.48043 5 9.73478 5 10C5 10.2652 5.10536 10.5196 5.29289 10.7071C5.48043 10.8946 5.73478 11 6 11C6.26522 11 6.51957 10.8946 6.70711 10.7071C6.89464 10.5196 7 10.2652 7 10C7 9.73478 6.89464 9.48043 6.70711 9.29289C6.51957 9.10536 6.26522 9 6 9ZM12 15C11.7348 15 11.4804 15.1054 11.2929 15.2929C11.1054 15.4804 11 15.7348 11 16C11 16.2652 11.1054 16.5196 11.2929 16.7071C11.4804 16.8946 11.7348 17 12 17C12.2652 17 12.5196 16.8946 12.7071 16.7071C12.8946 16.5196 13 16.2652 13 16C13 15.7348 12.8946 15.4804 12.7071 15.2929C12.5196 15.1054 12.2652 15 12 15Z"/></svg>',
            command: 'table.cellSetting'
        },
        'embed': {
            title: '## buttons.embed ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 6C5.73478 6 5.48043 6.10536 5.29289 6.29289C5.10536 6.48043 5 6.73478 5 7V11C5 11.2652 4.89464 11.5196 4.70711 11.7071L4.41421 12L4.70711 12.2929C4.89464 12.4804 5 12.7348 5 13V17C5 17.2652 5.10536 17.5196 5.29289 17.7071C5.48043 17.8946 5.73478 18 6 18C6.55228 18 7 18.4477 7 19C7 19.5523 6.55228 20 6 20C5.20435 20 4.44129 19.6839 3.87868 19.1213C3.31607 18.5587 3 17.7956 3 17V13.4142L2.29289 12.7071C1.90237 12.3166 1.90237 11.6834 2.29289 11.2929L3 10.5858V7C3 6.20435 3.31607 5.44129 3.87868 4.87868C4.44129 4.31607 5.20435 4 6 4C6.55228 4 7 4.44772 7 5C7 5.55228 6.55228 6 6 6ZM17 5C17 4.44772 17.4477 4 18 4C18.7956 4 19.5587 4.31607 20.1213 4.87868C20.6839 5.44129 21 6.20435 21 7V10.5858L21.7071 11.2929C22.0976 11.6834 22.0976 12.3166 21.7071 12.7071L21 13.4142V17C21 17.7957 20.6839 18.5587 20.1213 19.1213C19.5587 19.6839 18.7957 20 18 20C17.4477 20 17 19.5523 17 19C17 18.4477 17.4477 18 18 18C18.2652 18 18.5196 17.8946 18.7071 17.7071C18.8946 17.5196 19 17.2652 19 17V13C19 12.7348 19.1054 12.4804 19.2929 12.2929L19.5858 12L19.2929 11.7071C19.1054 11.5196 19 11.2652 19 11V7C19 6.73478 18.8946 6.48043 18.7071 6.29289C18.5196 6.10536 18.2652 6 18 6C17.4477 6 17 5.55228 17 5ZM12 8C12.5523 8 13 8.44772 13 9V11H15C15.5523 11 16 11.4477 16 12C16 12.5523 15.5523 13 15 13H13V15C13 15.5523 12.5523 16 12 16C11.4477 16 11 15.5523 11 15V13H9C8.44772 13 8 12.5523 8 12C8 11.4477 8.44772 11 9 11H11V9C11 8.44772 11.4477 8 12 8Z"/></svg>',
            observer: 'embed.observe',
            command: 'embed.popup'
        },
        'quote': {
            title: '## buttons.quote ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.58579 5.58579C4.96086 5.21071 5.46957 5 6 5H9C9.53043 5 10.0391 5.21071 10.4142 5.58579C10.7893 5.96086 11 6.46957 11 7V13C11 14.5025 10.6219 15.8236 9.78098 16.8747C8.94259 17.9227 7.72684 18.5989 6.24262 18.9701C5.70684 19.1041 5.16387 18.7784 5.02988 18.2426C4.89588 17.7068 5.2216 17.1639 5.75738 17.0299C6.94016 16.7341 7.72441 16.2438 8.21927 15.6253C8.7116 15.0099 9 14.1645 9 13V12H6C5.46957 12 4.96086 11.7893 4.58579 11.4142C4.21071 11.0391 4 10.5304 4 10V7C4 6.46957 4.21071 5.96086 4.58579 5.58579ZM9 10V7L6 7L6 10H9ZM13.5858 5.58579C13.9609 5.21071 14.4696 5 15 5H18C18.5304 5 19.0391 5.21071 19.4142 5.58579C19.7893 5.96086 20 6.46957 20 7V13C20 14.5025 19.6219 15.8236 18.781 16.8747C17.9426 17.9227 16.7268 18.5989 15.2426 18.9701C14.7068 19.1041 14.1639 18.7784 14.0299 18.2426C13.8959 17.7068 14.2216 17.1639 14.7574 17.0299C15.9402 16.7341 16.7244 16.2438 17.2193 15.6253C17.7116 15.0099 18 14.1645 18 13V12H15C14.4696 12 13.9609 11.7893 13.5858 11.4142C13.2107 11.0391 13 10.5304 13 10V7C13 6.46957 13.2107 5.96086 13.5858 5.58579ZM18 10L18 7H15V10H18Z"/></svg>',
            command: 'format.set'
        },
        'layout': {
            title: '## buttons.layout ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M2.58579 2.58579C2.96086 2.21071 3.46957 2 4 2H20C20.5304 2 21.0391 2.21071 21.4142 2.58579C21.7893 2.96086 22 3.46957 22 4V20C22 20.5304 21.7893 21.0391 21.4142 21.4142C21.0391 21.7893 20.5304 22 20 22H4C3.46957 22 2.96086 21.7893 2.58579 21.4142C2.21071 21.0391 2 20.5304 2 20V4C2 3.46957 2.21071 2.96086 2.58579 2.58579ZM13 20H20V4H13V20ZM11 4V20H4V4H11Z"/></svg>',
            command: 'layout.popup'
        },
        'wrapper': {
            title: '## buttons.wrapper ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M5 6C4.73478 6 4.48043 6.10536 4.29289 6.29289C4.10536 6.48043 4 6.73478 4 7V17C4 17.2652 4.10536 17.5196 4.29289 17.7071C4.48043 17.8946 4.73478 18 5 18H19C19.2652 18 19.5196 17.8946 19.7071 17.7071C19.8946 17.5196 20 17.2652 20 17V7C20 6.73478 19.8946 6.48043 19.7071 6.29289C19.5196 6.10536 19.2652 6 19 6H5ZM2.87868 4.87868C3.44129 4.31607 4.20435 4 5 4H19C19.7957 4 20.5587 4.31607 21.1213 4.87868C21.6839 5.44129 22 6.20435 22 7V17C22 17.7957 21.6839 18.5587 21.1213 19.1213C20.5587 19.6839 19.7957 20 19 20H5C4.20435 20 3.44129 19.6839 2.87868 19.1213C2.31607 18.5587 2 17.7956 2 17V7C2 6.20435 2.31607 5.44129 2.87868 4.87868Z"/></svg>',
            command: 'block.add'
        },
        'todo': {
            title: '## buttons.todo ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.79289 3.79289C7.18342 3.40237 7.81658 3.40237 8.20711 3.79289C8.59763 4.18342 8.59763 4.81658 8.20711 5.20711L5.70711 7.70711C5.31658 8.09763 4.68342 8.09763 4.29289 7.70711L2.79289 6.20711C2.40237 5.81658 2.40237 5.18342 2.79289 4.79289C3.18342 4.40237 3.81658 4.40237 4.20711 4.79289L5 5.58579L6.79289 3.79289ZM10 6C10 5.44772 10.4477 5 11 5H20C20.5523 5 21 5.44772 21 6C21 6.55228 20.5523 7 20 7H11C10.4477 7 10 6.55228 10 6ZM8.20711 9.79289C8.59763 10.1834 8.59763 10.8166 8.20711 11.2071L5.70711 13.7071C5.31658 14.0976 4.68342 14.0976 4.29289 13.7071L2.79289 12.2071C2.40237 11.8166 2.40237 11.1834 2.79289 10.7929C3.18342 10.4024 3.81658 10.4024 4.20711 10.7929L5 11.5858L6.79289 9.79289C7.18342 9.40237 7.81658 9.40237 8.20711 9.79289ZM10 12C10 11.4477 10.4477 11 11 11H20C20.5523 11 21 11.4477 21 12C21 12.5523 20.5523 13 20 13H11C10.4477 13 10 12.5523 10 12ZM8.20711 15.7929C8.59763 16.1834 8.59763 16.8166 8.20711 17.2071L5.70711 19.7071C5.31658 20.0976 4.68342 20.0976 4.29289 19.7071L2.79289 18.2071C2.40237 17.8166 2.40237 17.1834 2.79289 16.7929C3.18342 16.4024 3.81658 16.4024 4.20711 16.7929L5 17.5858L6.79289 15.7929C7.18342 15.4024 7.81658 15.4024 8.20711 15.7929ZM10 18C10 17.4477 10.4477 17 11 17H20C20.5523 17 21 17.4477 21 18C21 18.5523 20.5523 19 20 19H11C10.4477 19 10 18.5523 10 18Z"/></svg>',
            command: 'format.set'
        },
        'pre': {
            title: '## buttons.code-snippet ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.2425 3.02986C14.7783 3.16381 15.1041 3.70674 14.9701 4.24254L10.9701 20.2425C10.8362 20.7783 10.2933 21.1041 9.75746 20.9701C9.22167 20.8362 8.89591 20.2933 9.02986 19.7575L13.0299 3.75746C13.1638 3.22167 13.7067 2.89591 14.2425 3.02986ZM7.70711 7.29289C8.09763 7.68342 8.09763 8.31658 7.70711 8.70711L4.41421 12L7.70711 15.2929C8.09763 15.6834 8.09763 16.3166 7.70711 16.7071C7.31658 17.0976 6.68342 17.0976 6.29289 16.7071L2.29289 12.7071C1.90237 12.3166 1.90237 11.6834 2.29289 11.2929L6.29289 7.29289C6.68342 6.90237 7.31658 6.90237 7.70711 7.29289ZM16.2929 7.29289C16.6834 6.90237 17.3166 6.90237 17.7071 7.29289L21.7071 11.2929C22.0976 11.6834 22.0976 12.3166 21.7071 12.7071L17.7071 16.7071C17.3166 17.0976 16.6834 17.0976 16.2929 16.7071C15.9024 16.3166 15.9024 15.6834 16.2929 15.2929L19.5858 12L16.2929 8.70711C15.9024 8.31658 15.9024 7.68342 16.2929 7.29289Z"/></svg>',
            command: 'block.add'
        },
        'line': {
            title: '## buttons.line ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 12C3 11.4477 3.44772 11 4 11H20C20.5523 11 21 11.4477 21 12C21 12.5523 20.5523 13 20 13H4C3.44772 13 3 12.5523 3 12Z"/></svg>',
            command: 'block.add'
        },
        'parent': {
            title: '## buttons.parent ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 6H16C16.5523 6 17 6.44772 17 7C17 7.55228 16.5523 8 16 8H9.41421L17.7071 16.2929C18.0976 16.6834 18.0976 17.3166 17.7071 17.7071C17.3166 18.0976 16.6834 18.0976 16.2929 17.7071L8 9.41421V16C8 16.5523 7.55228 17 7 17C6.44772 17 6 16.5523 6 16V7C6 6.44772 6.44772 6 7 6Z"/></svg>',
            command: 'block.setParent'
        },
        'code': {
            title: '## buttons.code ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.2425 3.02986C14.7783 3.16381 15.1041 3.70674 14.9701 4.24254L10.9701 20.2425C10.8362 20.7783 10.2933 21.1041 9.75746 20.9701C9.22167 20.8362 8.89591 20.2933 9.02986 19.7575L13.0299 3.75746C13.1638 3.22167 13.7067 2.89591 14.2425 3.02986ZM7.70711 7.29289C8.09763 7.68342 8.09763 8.31658 7.70711 8.70711L4.41421 12L7.70711 15.2929C8.09763 15.6834 8.09763 16.3166 7.70711 16.7071C7.31658 17.0976 6.68342 17.0976 6.29289 16.7071L2.29289 12.7071C1.90237 12.3166 1.90237 11.6834 2.29289 11.2929L6.29289 7.29289C6.68342 6.90237 7.31658 6.90237 7.70711 7.29289ZM16.2929 7.29289C16.6834 6.90237 17.3166 6.90237 17.7071 7.29289L21.7071 11.2929C22.0976 11.6834 22.0976 12.3166 21.7071 12.7071L17.7071 16.7071C17.3166 17.0976 16.6834 17.0976 16.2929 16.7071C15.9024 16.3166 15.9024 15.6834 16.2929 15.2929L19.5858 12L16.2929 8.70711C15.9024 8.31658 15.9024 7.68342 16.2929 7.29289Z"/></svg>',
            command: 'inline.set',
            params: { tag: 'code' }
        },
        'underline': {
            title: '## buttons.underline ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 4C7.55228 4 8 4.44772 8 5V10C8 11.0609 8.42143 12.0783 9.17157 12.8284C9.92172 13.5786 10.9391 14 12 14C13.0609 14 14.0783 13.5786 14.8284 12.8284C15.5786 12.0783 16 11.0609 16 10V5C16 4.44772 16.4477 4 17 4C17.5523 4 18 4.44772 18 5V10C18 11.5913 17.3679 13.1174 16.2426 14.2426C15.1174 15.3679 13.5913 16 12 16C10.4087 16 8.88258 15.3679 7.75736 14.2426C6.63214 13.1174 6 11.5913 6 10V5C6 4.44772 6.44772 4 7 4ZM4 19C4 18.4477 4.44772 18 5 18H19C19.5523 18 20 18.4477 20 19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19Z"/></svg>',
            command: 'inline.set',
            params: { tag: 'u' }
        },
        'highlight': {
            title: '## buttons.highlight ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.7929 3.79289C13.5109 3.07492 14.4846 2.67157 15.5 2.67157C16.5154 2.67157 17.4891 3.07492 18.2071 3.79289C18.9251 4.51086 19.3284 5.48464 19.3284 6.5C19.3284 7.51536 18.9251 8.48913 18.2071 9.2071L17.2085 10.2057C17.2081 10.2061 17.2076 10.2066 17.2071 10.2071C17.2066 10.2076 17.2061 10.2081 17.2057 10.2085L9.20854 18.2057C9.20807 18.2061 9.20759 18.2066 9.20711 18.2071C9.20663 18.2076 9.20615 18.2081 9.20567 18.2085L7.70711 19.7071C7.51957 19.8946 7.26522 20 7 20H3C2.44772 20 2 19.5523 2 19V15C2 14.7348 2.10536 14.4804 2.29289 14.2929L12.7929 3.79289ZM12.5 6.91421L5.91421 13.5L8.5 16.0858L15.0858 9.5L12.5 6.91421ZM16.5 8.08579L13.9142 5.5L14.2071 5.2071C14.55 4.86421 15.0151 4.67157 15.5 4.67157C15.9849 4.67157 16.45 4.86421 16.7929 5.2071C17.1358 5.55 17.3284 6.01507 17.3284 6.5C17.3284 6.98493 17.1358 7.44999 16.7929 7.79289L16.5 8.08579ZM7.08579 17.5L4.5 14.9142L4 15.4142V18H6.58579L7.08579 17.5ZM16.2929 14.2929C16.4804 14.1054 16.7348 14 17 14H21C21.5523 14 22 14.4477 22 15V19C22 19.5523 21.5523 20 21 20H13C12.5955 20 12.2309 19.7564 12.0761 19.3827C11.9213 19.009 12.0069 18.5789 12.2929 18.2929L16.2929 14.2929ZM20 16H17.4142L15.4142 18H20V16Z"/></svg>',
            command: 'inline.set',
            params: { tag: 'mark' }
        },
        'sup': {
            title: '## buttons.superscript ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M17.9565 3.09068C18.7281 2.88025 19.5517 2.98495 20.2461 3.38175C20.5899 3.57822 20.8917 3.8405 21.1342 4.1536C21.3767 4.4667 21.5551 4.82449 21.6593 5.20655C21.7635 5.5886 21.7914 5.98744 21.7415 6.38029C21.6915 6.77313 21.5647 7.1523 21.3682 7.49613C21.3352 7.55397 21.2964 7.60836 21.2526 7.6585L19.2037 9.99999H21C21.5523 9.99999 22 10.4477 22 11C22 11.5523 21.5523 12 21 12H17C16.6076 12 16.2515 11.7705 16.0893 11.4132C15.9272 11.0559 15.989 10.6368 16.2474 10.3415L19.6701 6.42985C19.7146 6.33455 19.7441 6.23275 19.7574 6.12807C19.7743 5.99576 19.7648 5.86144 19.7298 5.73278C19.6947 5.60411 19.6346 5.48362 19.5529 5.37818C19.4713 5.27273 19.3696 5.1844 19.2538 5.11824C19.02 4.9846 18.7426 4.94934 18.4828 5.02021C18.2229 5.09108 18.0019 5.26227 17.8682 5.49613C17.5942 5.97565 16.9834 6.14225 16.5038 5.86824C16.0243 5.59423 15.8577 4.98337 16.1317 4.50385C16.5285 3.80945 17.1849 3.30112 17.9565 3.09068ZM4.37528 6.21913C4.80654 5.87412 5.43584 5.94404 5.78084 6.3753L8.99998 10.3992L12.2191 6.3753C12.5641 5.94404 13.1934 5.87412 13.6247 6.21913C14.0559 6.56414 14.1259 7.19343 13.7808 7.62469L10.2806 12L13.7808 16.3753C14.1259 16.8066 14.0559 17.4359 13.6247 17.7809C13.1934 18.1259 12.5641 18.056 12.2191 17.6247L8.99998 13.6008L5.78084 17.6247C5.43584 18.056 4.80654 18.1259 4.37528 17.7809C3.94402 17.4359 3.8741 16.8066 4.21911 16.3753L7.71935 12L4.21911 7.62469C3.8741 7.19343 3.94402 6.56414 4.37528 6.21913Z"/></svg>',
            command: 'inline.set',
            params: { tag: 'sup' }
        },
        'sub': {
            title: '## buttons.subscript ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.37528 6.21914C4.80654 5.87413 5.43584 5.94405 5.78084 6.37531L8.99998 10.3992L12.2191 6.37531C12.5641 5.94405 13.1934 5.87413 13.6247 6.21914C14.0559 6.56415 14.1259 7.19344 13.7808 7.6247L10.2806 12L13.7808 16.3753C14.1259 16.8066 14.0559 17.4359 13.6247 17.7809C13.1934 18.1259 12.5641 18.056 12.2191 17.6247L8.99998 13.6008L5.78084 17.6247C5.43584 18.056 4.80654 18.1259 4.37528 17.7809C3.94402 17.4359 3.8741 16.8066 4.21911 16.3753L7.71935 12L4.21911 7.6247C3.8741 7.19344 3.94402 6.56415 4.37528 6.21914ZM17.9565 12.0907C18.3386 11.9865 18.7374 11.9586 19.1303 12.0085C19.5231 12.0585 19.9023 12.1853 20.2461 12.3818C20.5899 12.5782 20.8917 12.8405 21.1342 13.1536C21.3767 13.4667 21.5551 13.8245 21.6593 14.2066C21.7635 14.5886 21.7914 14.9875 21.7415 15.3803C21.6915 15.7731 21.5647 16.1523 21.3682 16.4961C21.3352 16.554 21.2964 16.6084 21.2526 16.6585L19.2037 19H21C21.5523 19 22 19.4477 22 20C22 20.5523 21.5523 21 21 21H17C16.6076 21 16.2515 20.7705 16.0893 20.4132C15.9272 20.0559 15.989 19.6368 16.2474 19.3415L19.6701 15.4299C19.7146 15.3346 19.7441 15.2328 19.7574 15.1281C19.7743 14.9958 19.7648 14.8615 19.7298 14.7328C19.6947 14.6041 19.6346 14.4836 19.5529 14.3782C19.4713 14.2727 19.3696 14.1844 19.2538 14.1182C19.138 14.0521 19.0104 14.0094 18.878 13.9926C18.7457 13.9757 18.6114 13.9851 18.4828 14.0202C18.3541 14.0553 18.2336 14.1154 18.1282 14.1971C18.0227 14.2787 17.9344 14.3804 17.8682 14.4961C17.5942 14.9757 16.9834 15.1423 16.5038 14.8682C16.0243 14.5942 15.8577 13.9834 16.1317 13.5039C16.3282 13.16 16.5905 12.8583 16.9036 12.6158C17.2167 12.3733 17.5745 12.1949 17.9565 12.0907Z"/></svg>',
            command: 'inline.set',
            params: { tag: 'sub' }
        },
        'removeinline': {
            title: '## buttons.clear-all-styles ##',
            position: 'last',
            command: 'inline.removeFormat'
        },
        'heading': {
            title: '## buttons.heading ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 6C2 5.44772 2.44772 5 3 5H5C5.55228 5 6 5.44772 6 6C6 6.55228 5.55228 7 5 7V11H11V7C10.4477 7 10 6.55228 10 6C10 5.44772 10.4477 5 11 5H13C13.5523 5 14 5.44772 14 6C14 6.55228 13.5523 7 13 7V17C13.5523 17 14 17.4477 14 18C14 18.5523 13.5523 19 13 19H11C10.4477 19 10 18.5523 10 18C10 17.4477 10.4477 17 11 17V13H5V17C5.55228 17 6 17.4477 6 18C6 18.5523 5.55228 19 5 19H3C2.44772 19 2 18.5523 2 18C2 17.4477 2.44772 17 3 17V7C2.44772 7 2 6.55228 2 6ZM19.3827 9.07612C19.7564 9.2309 20 9.59554 20 10V18C20 18.5523 19.5523 19 19 19C18.4477 19 18 18.5523 18 18V12.4142L17.7071 12.7071C17.3166 13.0976 16.6834 13.0976 16.2929 12.7071C15.9024 12.3166 15.9024 11.6834 16.2929 11.2929L18.2929 9.29289C18.5789 9.0069 19.009 8.92134 19.3827 9.07612Z"/></svg>',
            command: 'block.add'
        },
        'text': {
            title: '## buttons.text ##',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M5 6C5 5.44772 5.44772 5 6 5H18C18.5523 5 19 5.44772 19 6C19 6.55228 18.5523 7 18 7H13V18C13 18.5523 12.5523 19 12 19C11.4477 19 11 18.5523 11 18V7H6C5.44772 7 5 6.55228 5 6Z"/></svg>',
            command: 'format.set'
        },
        'h1': {
            title: '## buttons.heading ## 1',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 6C2 5.44772 2.44772 5 3 5H5C5.55228 5 6 5.44772 6 6C6 6.55228 5.55228 7 5 7V11H11V7C10.4477 7 10 6.55228 10 6C10 5.44772 10.4477 5 11 5H13C13.5523 5 14 5.44772 14 6C14 6.55228 13.5523 7 13 7V17C13.5523 17 14 17.4477 14 18C14 18.5523 13.5523 19 13 19H11C10.4477 19 10 18.5523 10 18C10 17.4477 10.4477 17 11 17V13H5V17C5.55228 17 6 17.4477 6 18C6 18.5523 5.55228 19 5 19H3C2.44772 19 2 18.5523 2 18C2 17.4477 2.44772 17 3 17V7C2.44772 7 2 6.55228 2 6ZM19.3827 9.07612C19.7564 9.2309 20 9.59554 20 10V18C20 18.5523 19.5523 19 19 19C18.4477 19 18 18.5523 18 18V12.4142L17.7071 12.7071C17.3166 13.0976 16.6834 13.0976 16.2929 12.7071C15.9024 12.3166 15.9024 11.6834 16.2929 11.2929L18.2929 9.29289C18.5789 9.0069 19.009 8.92134 19.3827 9.07612Z"/></svg>',
            command: 'format.set'
        },
        'h2': {
            title: '## buttons.heading ## 2',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 6C2 5.44772 2.44772 5 3 5H5C5.55228 5 6 5.44772 6 6C6 6.55228 5.55228 7 5 7V11H11V7C10.4477 7 10 6.55228 10 6C10 5.44772 10.4477 5 11 5H13C13.5523 5 14 5.44772 14 6C14 6.55228 13.5523 7 13 7V17C13.5523 17 14 17.4477 14 18C14 18.5523 13.5523 19 13 19H11C10.4477 19 10 18.5523 10 18C10 17.4477 10.4477 17 11 17V13H5V17C5.55228 17 6 17.4477 6 18C6 18.5523 5.55228 19 5 19H3C2.44772 19 2 18.5523 2 18C2 17.4477 2.44772 17 3 17V7C2.44772 7 2 6.55228 2 6ZM19 11C18.7348 11 18.4804 11.1054 18.2929 11.2929C18.1054 11.4804 18 11.7348 18 12C18 12.5523 17.5523 13 17 13C16.4477 13 16 12.5523 16 12C16 11.2043 16.3161 10.4413 16.8787 9.87868C17.4413 9.31607 18.2043 9 19 9C19.7957 9 20.5587 9.31607 21.1213 9.87868C21.6839 10.4413 22 11.2043 22 12C22 12.5095 21.8269 12.9956 21.6442 13.3786C21.4547 13.776 21.2129 14.1483 20.9883 14.4523L20.9769 14.4674L19.0297 17.001H21C21.5523 17.001 22 17.4487 22 18.001C22 18.5533 21.5523 19.001 21 19.001H17C16.6191 19.001 16.2713 18.7846 16.103 18.443C15.9346 18.1013 15.975 17.6936 16.2071 17.3916L19.3851 13.2564C19.5575 13.0223 19.7216 12.7639 19.839 12.5176C19.9646 12.2544 20 12.0815 20 12C20 11.7348 19.8946 11.4804 19.7071 11.2929C19.5196 11.1054 19.2652 11 19 11Z"/></svg>',
            command: 'format.set'
        },
        'h3': {
            title: '## buttons.heading ## 3',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 6C2 5.44772 2.44772 5 3 5H5C5.55228 5 6 5.44772 6 6C6 6.55228 5.55228 7 5 7V11H11V7C10.4477 7 10 6.55228 10 6C10 5.44772 10.4477 5 11 5H13C13.5523 5 14 5.44772 14 6C14 6.55228 13.5523 7 13 7V17C13.5523 17 14 17.4477 14 18C14 18.5523 13.5523 19 13 19H11C10.4477 19 10 18.5523 10 18C10 17.4477 10.4477 17 11 17V13H5V17C5.55228 17 6 17.4477 6 18C6 18.5523 5.55228 19 5 19H3C2.44772 19 2 18.5523 2 18C2 17.4477 2.44772 17 3 17V7C2.44772 7 2 6.55228 2 6ZM17.8519 9.22836C18.4001 9.0013 19.0033 8.94189 19.5853 9.05764C20.1672 9.1734 20.7018 9.45912 21.1213 9.87868C21.5409 10.2982 21.8266 10.8328 21.9424 11.4147C22.0581 11.9967 21.9987 12.5999 21.7716 13.1481C21.6417 13.4618 21.4601 13.7495 21.2361 14C21.4601 14.2505 21.6417 14.5382 21.7716 14.8519C21.9987 15.4001 22.0581 16.0033 21.9424 16.5853C21.8266 17.1672 21.5409 17.7018 21.1213 18.1213C20.7018 18.5409 20.1672 18.8266 19.5853 18.9424C19.0033 19.0581 18.4001 18.9987 17.8519 18.7716C17.3038 18.5446 16.8352 18.1601 16.5056 17.6667C16.1759 17.1734 16 16.5933 16 16C16 15.4477 16.4477 15 17 15C17.5523 15 18 15.4477 18 16C18 16.1978 18.0586 16.3911 18.1685 16.5556C18.2784 16.72 18.4346 16.8482 18.6173 16.9239C18.8 16.9996 19.0011 17.0194 19.1951 16.9808C19.3891 16.9422 19.5673 16.847 19.7071 16.7071C19.847 16.5673 19.9422 16.3891 19.9808 16.1951C20.0194 16.0011 19.9996 15.8 19.9239 15.6173C19.8482 15.4346 19.72 15.2784 19.5556 15.1685C19.3911 15.0587 19.1978 15 19 15C18.4477 15 18 14.5523 18 14C18 13.4477 18.4477 13 19 13C19.1978 13 19.3911 12.9414 19.5556 12.8315C19.72 12.7216 19.8482 12.5654 19.9239 12.3827C19.9996 12.2 20.0194 11.9989 19.9808 11.8049C19.9422 11.6109 19.847 11.4327 19.7071 11.2929C19.5673 11.153 19.3891 11.0578 19.1951 11.0192C19.0011 10.9806 18.8 11.0004 18.6173 11.0761C18.4346 11.1518 18.2784 11.28 18.1685 11.4444C18.0586 11.6089 18 11.8022 18 12C18 12.5523 17.5523 13 17 13C16.4477 13 16 12.5523 16 12C16 11.4067 16.1759 10.8266 16.5056 10.3333C16.8352 9.83994 17.3038 9.45543 17.8519 9.22836Z"/></svg>',
            command: 'format.set'
        },
        'h4': {
            title: '## buttons.heading ## 4',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 6C2 5.44772 2.44772 5 3 5H5C5.55228 5 6 5.44772 6 6C6 6.55228 5.55228 7 5 7V11H11V7C10.4477 7 10 6.55228 10 6C10 5.44772 10.4477 5 11 5H13C13.5523 5 14 5.44772 14 6C14 6.55228 13.5523 7 13 7V17C13.5523 17 14 17.4477 14 18C14 18.5523 13.5523 19 13 19H11C10.4477 19 10 18.5523 10 18C10 17.4477 10.4477 17 11 17V13H5V17C5.55228 17 6 17.4477 6 18C6 18.5523 5.55228 19 5 19H3C2.44772 19 2 18.5523 2 18C2 17.4477 2.44772 17 3 17V7C2.44772 7 2 6.55228 2 6ZM20.2898 9.04291C20.7115 9.17061 21 9.55933 21 10V15C21.5523 15 22 15.4477 22 16C22 16.5523 21.5523 17 21 17V18C21 18.5523 20.5523 19 20 19C19.4477 19 19 18.5523 19 18V17H16C15.6312 17 15.2923 16.797 15.1183 16.4719C14.9443 16.1467 14.9634 15.7522 15.1679 15.4453L19.1679 9.4453C19.4124 9.07864 19.868 8.91521 20.2898 9.04291ZM19 15V13.3028L17.8685 15H19Z"/></svg>',
            command: 'format.set'
        },
        'h5': {
            title: '## buttons.heading ## 5',
            command: 'format.set'
        },
        'h6': {
            title: '## buttons.heading ## 6',
            command: 'format.set'
        },
        'address': {
            title: '## buttons.address ##',
            command: 'format.set'
        }
    },
    nested: [],
    nestedValue: [],
    nonparse: [],
    inlineGroups: {},
    tags: {
        denied: ['font', 'html', 'head', 'link', 'title', 'body', 'meta', 'applet', 'marquee'],
        incode: ['!DOCTYPE', '!doctype', 'html', 'head', 'link', 'title', 'body', 'meta', 'textarea', 'style'],
        form: ['form', 'input', 'button', 'select', 'textarea', 'legend', 'fieldset'],
        inline: ['a', 'svg', 'span', 'strong', 'strike', 'b', 'u', 'em', 'i', 'code', 'del', 'ins', 'samp', 'kbd', 'sup', 'sub', 'mark', 'var', 'cite', 'small', 'abbr'],
        block: ['pre', 'hr', 'ul', 'ol', 'li', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',  'dl', 'dt', 'dd', 'div', 'table', 'tbody', 'thead', 'tfoot', 'tr', 'th', 'td', 'blockquote', 'output', 'figcaption', 'figure', 'address', 'main', 'section', 'header', 'footer', 'aside', 'article', 'iframe', 'details'],
        parser: ['pre', 'hr', 'ul', 'ol', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'address', 'blockquote', 'figure', 'iframe', 'form', 'dl', 'div', 'section', 'header', 'footer', 'article', 'main', 'aside']
    },
    regex: {
        mp4video: /https?:\/\/\S+\.mp4/gi,
        youtube: /^https?\:\/\/(?:www\.youtube(?:\-nocookie)?\.com\/|m\.youtube\.com\/|youtube\.com\/)?(?:ytscreeningroom\?vi?=|youtu\.be\/|vi?\/|live|user\/.+\/u\/\w{1,2}\/|embed\/|watch\?(?:.*\&)?vi?=|\&vi?=|\?(?:.*\&)?vi?=)([^#\&\?\n\/<>"']*)/gi,
        vimeo: /(http|https)?:\/\/(?:www.|player.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:\/[a-zA-Z0-9_-]+)?/gi,
        imageurl: /((https?|www)[^\s]+\.)(jpe?g|png|gif)(\?[^\s-]+)?/gi,
        aurl1: /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim,
        aurl2: /(^|[^\/])(www\.[\S]+(\b|$))/gim
    }
};
Redactor.lang['en'] = {
    "accessibility": {
        "help-label": "Rich text editor"
    },
    "placeholders": {
        "figcaption": "Type caption (optional)"
    },
    "embed": {
        "embed": "Embed",
        "title": "Title",
        "poster": "Poster image",
        "caption": "Caption",
        "description": "Paste any embed/html code or enter the url (vimeo or youtube video only)",
        "responsive-video": "Responsive video"
    },
    "image": {
        "tab-select": "Select",
        "tab-upload": "Upload",
        "tab-url": "Url",
        "tab-props": "Props",
        "alt-text": "Alt Text",
        "link": "Link",
        "src": "Src",
        "width": "Width",
        "height": "Height",
        "caption": "Caption",
        "link-in-new-tab": "Open link in new tab",
        "url-placeholder": "Paste url of image...",
        "upload-new-placeholder": "Drag to upload a new image<br>or click to select"
    },
    "list": {
        "select-list": "Select list"
    },
    "link": {
        "link": "Link",
        "edit-link": "Edit Link",
        "unlink": "Unlink",
        "link-in-new-tab": "Open link in new tab",
        "text": "Text",
        "url": "URL"
    },
    "table": {
        "width": "Width (px or %)",
        "nowrap": "Nowrap",
        "table-cell": "Table cell",
        "select-table": "Select table",
        "select-cell": "Select cell",
        "cell-setting": "Cell setting",
        "add-head": "Add head",
        "remove-head": "Remove head",
        "add-row-below": "Add row below",
        "add-row-above": "Add row above",
        "remove-row": "Remove row",
        "add-column-after": "Add column after",
        "add-column-before": "Add column before",
        "remove-column": "Remove column",
        "delete-table": "Delete table"
    },
    "buttons": {
        "add": "Add",
        "insert": "Insert",
        "save": "Save",
        "cancel": "Cancel",
        "delete": "Delete",
        "ai-tools": "AI Tools",
        "ai-image": "AI Image",
        "html": "HTML",
        "format": "Format",
        "bold": "Bold",
        "italic": "Italic",
        "deleted": "Deleted",
        "more-formatting": "More formatting",
        "link": "Link",
        "link-text": "Link Text",
        "unlink": "Unlink",
        "image": "Image",
        "unwrap": "Unwrap",
        "outset": "Outset",
        "wrap-image": "Wrap image",
        "move-up": "Move up",
        "move-down": "Move down",
        "list": "List",
        "numbered-list": "Numbered list",
        "bullet-list": "Bullet list",
        "indent": "Indent",
        "outdent": "Outdent",
        "definition-list": "Definition list",
        "hotkeys": "Hotkeys",
        "undo": "Undo",
        "redo": "Redo",
        "toggle": "Toggle",
        "duplicate": "Duplicate",
        "table": "Table",
        "embed": "Embed",
        "quote": "Quote",
        "layout": "Layout",
        "wrapper": "Wrapper",
        "todo": "Todo",
        "code-snippet": "Code snippet",
        "line": "Line",
        "parent": "Parent",
        "code": "Code",
        "underline": "Underline",
        "highlight": "Highlight",
        "superscript": "Superscript",
        "subscript": "Subscript",
        "clear-all-styles": "Clear all styles",
        "heading": "Heading",
        "text": "Text",
        "address": "Address"
    },
    "colorpicker": {
        "remove-color":  "Remove color",
        "remove-background":  "Remove background color",
        "color": "Color",
        "background": "Background",
        "set-color": "Set color"
    },
    "pathbar": {
        "title": "Body"
    },
    "layout": {
        "select-layout": "Select layout",
        "select-column": "Select column",
        "single-column": "Single column",
        "two-columns": "Two columns",
        "three-columns": "Three columns",
        "four-columns": "Four columns"
    },
    "outset": {
        "outset-none": "Outset none",
        "outset-left": "Outset left",
        "outset-both": "Outset both",
        "outset-right": "Outset right"
    },
    "wrap": {
        "wrap-none": "Wrap none",
        "wrap-left": "Wrap left",
        "wrap-center": "Wrap center",
        "wrap-right": "Wrap right"
    },
    "blocks": {
        "address": "Address",
        "cell": "Cell",
        "column": "Column",
        "dlist": "Definition List",
        "embed": "Embed",
        "figcaption": "Figcaption",
        "heading": "Heading",
        "image": "Image",
        "wrapper": "Wrapper",
        "layout": "Layout",
        "line": "Line",
        "list": "List",
        "listitem": "Item",
        "noneditable": "Noneditable",
        "pre": "Pre",
        "quote": "Quote",
        "row": "Row",
        "table": "Table",
        "text": "Text",
        "todo": "Todo",
        "todoitem": "Item",
        "mergetag": "Mergetag"
    },
    "hotkeys": {
        "meta-shift-a": "Select text in the block",
        "meta-a": "Select all blocks",
        "meta-z": "Undo",
        "meta-shift-z": "Redo",
        "meta-shift-m": "Remove inline format",
        "meta-b": "Bold",
        "meta-i": "Italic",
        "meta-u": "Underline",
        "meta-h": "Superscript",
        "meta-l": "Subscript",
        "meta-k": "Link",
        "meta-alt-0": "Normal text",
        "meta-alt-1": "Heading 1",
        "meta-alt-2": "Heading 2",
        "meta-alt-3": "Heading 3",
        "meta-alt-4": "Heading 4",
        "meta-alt-5": "Heading 5",
        "meta-alt-6": "Heading 6",
        "meta-shift-7": "Ordered List",
        "meta-shift-8": "Unordered List",
        "meta-indent": "Indent",
        "meta-outdent": "Outdent",
        "meta-shift-backspace": "Delete block",
        "meta-shift-o": "Add block",
        "meta-shift-d": "Duplicate block",
        "meta-shift-up": "Move line up",
        "meta-shift-down": "Move line down"
    }
};
/*jshint esversion: 6 */
class App {
    constructor(element, options = {}, uuid = 0) {
        this.ajax = Redactor.ajax;
        this.dom = Redactor.dom;
        this.uuid = uuid;
        this.$win = this.dom(window); // @deprecated 5.0
        this.$doc = this.dom(document); // @deprecated 5.0
        this.$body = this.dom('body'); // @deprecated 5.0
        this.keycodes = Redactor.keycodes;
        this.element = new AppElement(element);
        this.app = this;

        // local
        this.disableMode = false;
        this.readonlyMode = false;
        this._core = ['ajax', 'dom', 'uuid', 'keycodes', 'config', 'loc'];
        this._modules = {
            container: ContainerModule,
            source: SourceModule,
            editor: EditorModule,
            event: EventModule,
            codemirror: CodemirrorModule,
            placeholder: PlaceholderModule,
            block: BlockModule,
            blocks: BlockCollectionModule,
            sync: SyncModule,
            observer: ObserverModule,
            scroll: ScrollModule,
            autosave: AutosaveModule,
            input: InputModule,
            format: FormatModule,
            inline: InlineModule,
            state: StateModule,
            progress: ProgressModule,
            hotkeys: HotkeysModule,

            image: ImageManager,
            embed: EmbedManager,
            layout: LayoutManager,
            list: ListManager,
            link: LinkManager,
            table: TableManager,

            ui: UIManager,

            toolbar: ToolBar,
            extrabar: ExtraBar,
            addbar: AddBar,
            context: ContextBar,
            control: ControlBar,
            path: PathBar,
            statusbar: StatusBar,
            dropdown: Dropdown,
            command: CommandPalette
        };
        this._plugins = [];
        this._props = {};
        this._mode = 'default';
        this.started = false;
        this.loaded = false;

        // Start
        this._start(options);
    }

    start(options = {}) {
        this._start(options, true);
    }

    stop() {
        if (this.isStopped()) return;

        // stopping
        this.eventBus.emit('app.before.stop');

        // stop
        this._iterate('stop');
        this._iterate2('stop');

        // show element
        this.element.showElement();

        // stopped
        this._plugins = [];
        this.started = false;

        // stop event
        this.eventBus.emit('app.stop');

        // click to edit
        if (this.config.get('clicktoedit')) {
            this.eventBus = new EventBus(this);
            this._waitForClickToEdit();
        }
    }

    enable() {
        this.editor.enable();
        this.ui.enable();
        this.disableMode = false;
    }

    editable() {
        this.editor.editable();
        this.ui.enable();
        this.readonlyMode = false;
    }

    disable() {
        this.editor.disable();
        this._disable();
        this.disableMode = true;
    }

    readonly() {
        this.editor.readonly();
        this._disable();
        this.readonlyMode = true;
    }

    api(name, ...args) {
        if (!name) return;

        const namespaces = name.split(".");
        const func = namespaces.pop();
        let context = this;

        // Navigate through namespaces to find the target context
        for (const namespace of namespaces) {
            if (context[namespace] === undefined) return;
            context = context[namespace];
        }

        // Call the function if it exists and is indeed a function
        if (typeof context[func] === 'function') {
            return context[func](...args);
        }
    }

    create(name, ...args) {
        const map = { // @deprecated 5.0
            'selection': 'TextRange',
            'predefined': 'ClassApplier',
            'element': 'ElementInspector',
            'colorpicker': 'ColorPicker',
            'form': 'UIForm',
            'upload': 'Uploader'
        };

        // Checking the existence of class
        let className = map[name] || name;
        className = this._toPascalCase(className);
        if (typeof Redactor[className] === 'function') {
            return new Redactor[className](this, ...args);
        }

        return this._create(name, ...args);
    }

    _toPascalCase(str) {
        return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase())
                  .replace(/^./, (firstLetter) => firstLetter.toUpperCase());
    }

    // @deprecated 5.0
    _create(name, ...args) {
        let [type, actualName] = name.includes('.') ? name.split('.') : ['class', name];

        // Checking the existence of type and name in Redactor.mapping
        let mapping = Redactor.mapping[type]?.[actualName];
        if (!mapping) {
            if (type === 'block') {
                console.warn(`${type} "${actualName}" not found`);
                actualName = 'wrapper';
                mapping = Redactor.mapping['block'][actualName];
            } else {
                throw new Error(`The ${type} "${actualName}" does not exist.`);
            }
        }

        // Creating an instance
        const instance = new mapping.proto();

        // Extending an instance with properties
        Object.assign(instance, {
            _name: actualName,
            app: this,
            uuid: this.uuid,
            keycodes: this.keycodes,
            dom: this.dom,
            ajax: this.ajax,
            $win: this.$win,
            $doc: this.$doc,
            $body: this.$body,
            lang: this.lang,
            opts: this.opts
        });

        // Initialization of the instance if there is an init method
        const result = instance.init?.(...args);
        return result || instance;
    }

    destroy() {
        this.sync.destroy();

        // stop
        this.stop();

        // broadcast
        this.eventBus.emit('app.destroy');

        // element and instance
        this.element.dataset(Redactor.namespace, false);
        this._clearInstance();
    }

    on(event, listener) {
        this.eventBus.on(event, listener);
    }

    emit(name, params) {
        return this.eventBus.emit(name, params);
    }

    emitHtml(name, html) {
        return this.eventBus.emitHtml(name, html);
    }

    broadcast(name, params) {
        return this.eventBus.emit(name, params);
    }

    broadcastHtml(name, html) {
        return this.eventBus.emitHtml(name, html);
    }

    // Has

    has(name) {
        return (this[name] || this._plugins[name]);
    }

    // Is

    isStarted() {
        return this.started;
    }

    isStopped() {
        return !this.started;
    }

    isDisabled() {
        return this.disableMode;
    }

    isReadonly() {
        return this.readonlyMode;
    }

    isMode(name) {
        return this._mode === name;
    }

    isProp(name) {
        return this.getProp(name);
    }

    // Set

    setMode(name) {
        this._mode = name;
    }

    setProp(name, value) {
        this._props[name] = value;
    }

    // Get

    getLayout() {
        return (this.editor) ? this.editor.getLayout() : false;
    }

    getEditor() {
        return (this.editor) ? this.editor.getEditor() : false;
    }

    getMode() {
        return this._mode;
    }

    getProp(name) {
        return this._props[name];
    }

    // Remove

    removeProp(name) {
        delete this._props[name];
    }

    // Private methods

    _start(options = {}, force = false) {
        // Initialization of core components
        this._initializeConfig(options);
        this._initializeCoreComponents();
        this._initModes();

        // Initializing the editor
        if (!force && this.config.is('clicktoedit')) {
            this._waitForClickToEdit();
        } else {
            this._init();
        }
    }

    _disable() {
        this.source.close();
        this.ui.disable();
        this.ui.close();
        this.block.unset();
        this.blocks.unset();

        const selection = new TextRange(this.app)
        selection.remove();
    }

    _initModes() {
        // opts
        if (this.config.is('nocontainer')) {
            this.config.extend(this.config.get('modes.nocontainer'));
        }

        // modes
        if (this.config.is('css')) {
            this.setMode('iframe');
        }
    }

    _initializeConfig(options) {
        this.config = new ConfigModule(this, options);
        this.opts = this.config; // @deprecated 5.0: use config
    }

    _initializeCoreComponents() {
        this.loc = new LocalizationManager(this, this.config.get('lang'));
        this.lang = this.loc; // @deprecated 5.0: use loc
        this.eventBus = new EventBus(this);
        this.page = new PageModule(this);
    }

    _waitForClickToEdit() {
        const startEditor = () => {
            const marker = new Marker(this);
            this.eventBus.emit('clicktoedit.before.start');
            marker.save(true);

            this._init()

            marker.restore();

            this.editor.click();
            this.eventBus.emit('clicktoedit.start');
            this.editor.setBlurOther();
        };

        this.element.one('click.rx-clicktoedit', startEditor);
    }

    _init() {
        this._bindEventsFromConfig();
        //this._initializePlugins();

        // starting
        this.eventBus.emit('app.before.start');

        // hide element
        this.element.hideElement();

        // init modules
        Object.keys(this._modules).forEach(key => {
            this[key] = new this._modules[key](this);
        });

        // dependences
        this._injectDependencies();

        // plugins
        this._iterate('init'); // @deprecated 5.0

        // init
        this._iterate2('init');

        // plugins
        this._iterate('start'); // @deprecated 5.0

        // load
        this._iterate2('load');
        this._iterate('load'); // @deprecated 5.0

        // loaded methods
        let loadedInterval = setInterval(() => {
            if (this.loaded) {
                clearInterval(loadedInterval);
                this._iterate('loaded');
            }
        }, 100);

        // started
        this.started = true;
        this.eventBus.emit('app.start');
        this.element.off('click.rx-clicktoedit');

        // modes
        this._buildReadonly();
        this._buildDisabled();
    }

    _bindEventsFromConfig() {
        let configEvents = this.config.get('events') || this.config.get('subscribe'); // @deprecated 5.0: subscribe
        if (configEvents) {
            for (const [events, handler] of Object.entries(configEvents)) {
                const eventList = events.split(' ');
                eventList.forEach(event => {
                    if (typeof handler === 'function') {
                        this.eventBus.on(event, handler);
                    }
                });
            }
        }
    }

    _injectDependencies() {

        Object.keys(this._modules).forEach(name => {
            this._core.forEach(dependence => {
                this[name][dependence] = this[dependence];
            });
        });
    }

    _iterate2(method) {
        Object.keys(this._modules).forEach(name => {
            const instance = this[name];
            const methodToCall = instance?.[method];

            if (typeof methodToCall === 'function') {
                methodToCall.apply(instance);
            }
        });
    }

    _iterate(method) {
        if (typeof Redactor.mapping.plugin !== 'undefined') {
            let plugins = this.opts.get('plugins');
            for (let i = 0; i < plugins.length; i++) {
                let name = plugins[i];
                if (typeof Redactor.mapping.plugin[name] === 'undefined') continue;

                if (method === 'init') {
                    this._plugins.push(name);
                }
                this._iterateItem('plugin', name, method);
            }
        }
    }

    _iterateItem(type, name, method) {
        if (method === 'init') {
            this[name] = this.create(type + '.' + name);
        }
        else {
            this._call(this[name], method);
        }
    }

    _call(instance, method) {
        if (typeof instance[method] === 'function') {
            instance[method].apply(instance);
        }
    }

    _buildDisabled() {
        this.disableMode = (this.opts.get('disabled') || this.element.isDisabled());
        if (this.disableMode) {
            this.disable();
        }
    }

    _buildReadonly() {
        this.readonlyMode = (this.opts.get('readonly') || this.element.isReadonly());
        if (this.readonlyMode) {
            this.readonly();
        }
    }

    _clearInstance() {
        let index = Redactor.instances.indexOf(this.uuid);
        if (index > -1) {
            Redactor.instances.splice(index, 1);
        }
    }
}
/*jshint esversion: 6 */
class AppElement extends Dom {
    constructor(element) {
        super(element);
    }

    isTextarea() {
        return this.tag('textarea');
    }

    isDisabled() {
        return (this.attr('disabled') !== null);
    }

    isReadonly() {
        return (this.attr('readonly') !== null);
    }

    hideElement() {
        if (this.isTextarea()) {
            this.addClass('rx-visually-hidden');
        }
    }

    showElement() {
        if (this.isTextarea()) {
            this.removeClass('rx-visually-hidden');
        }
    }

    setHtml(content) {
        if (this.isTextarea()) {
            this.val(content);
        } else {
            this.html(content);
        }
    }

    getHtml() {
        return (this.isTextarea()) ? this.val() : this.html();
    }

    getName() {
        return this.attr('name');
    }

    getPlaceholder() {
        return this.attr('placeholder');
    }




}
class Autoparse {
    constructor(app) {
        this.app = app;
        this.config = app.config;

        // local
        this.maxLength = this.config.get('link.size');
        this.linkTarget = this.config.get('paste.linkTarget');
        this.https = this.config.get('https');
        this.urlPattern = /(?:https?|ftp):\/\/[^\s/$.?#].[^\s]*|www\.[^\s/$.?#].[^\s]*/gi;
        this.imagePattern = /\.(jpeg|jpg|png|gif)$/i;
        this.excludeTags = new Set(['figure', 'html', 'form', 'pre', 'div', 'span', 'svg', 'path', 'video', 'object', 'iframe', 'source', 'code', 'a', 'img', 'link', 'script']);
    }

    format(html) {
        if (!this.config.is('paste.autoparse')) return html;

        const storage = new CleanerStorage(this.app);

        // Store comments
        html = storage.storeComments(html);

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Traverse all elements, excluding those within excludeTags and comments
        this._traverseNodes(doc.body);

        // Replace HTML entities globally in the entire HTML
        const final =
            (doc.head?.innerHTML ? `<head>${doc.head.innerHTML}</head>` : '') +
            `<body>${doc.body.innerHTML.replace(/&amp;/g, '&')}</body>`;

        html = `<html>${final}</html>`;
        html = storage.restoreComments(html);

        return html;
    }

    // Private methods

    _traverseNodes(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (this.excludeTags.has(node.tagName.toLowerCase())) {
                return; // Skip excluded tags
            }

            // Recursively traverse child nodes
            Array.from(node.childNodes).forEach((child) => this._traverseNodes(child));
        } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            // Process only non-empty text nodes
            this._processTextNode(node);
        } else if (node.nodeType === Node.COMMENT_NODE) {
            return; // Skip comments
        }
    }

    _processTextNode(node) {
        const updatedText = this._replaceContent(node.textContent);
        if (updatedText !== node.textContent) {
            const tempElement = document.createElement('div');
            tempElement.innerHTML = updatedText;

            // Replace the text node with the new HTML content
            const fragment = document.createDocumentFragment();
            while (tempElement.firstChild) {
                fragment.appendChild(tempElement.firstChild);
            }
            node.parentNode.replaceChild(fragment, node);
        }
    }

    _replaceContent(text) {
        return text.replace(this.urlPattern, (url) => {
            const fullUrl = this._addProtocolIfNeeded(url);

            if (this._isImageUrl(fullUrl)) {
                return this._createImageTag(fullUrl);
            }

            return this._createLinkTag(fullUrl, url);
        });
    }

    _addProtocolIfNeeded(url) {
        // Add https or http if the option is enabled and the protocol is missing
        const hasProtocol = /^(https?|ftp):\/\//.test(url);

        if (this.https && !hasProtocol) {
            return `https://${url}`;
        } else if (!this.https && !hasProtocol) {
            return `http://${url}`;
        }
        return url;
    }

    _isImageUrl(url) {
        return this.imagePattern.test(url);
    }

    _createImageTag(url) {
        return `<img src="${url}">`;
    }

    _createLinkTag(fullUrl, displayUrl) {
        // Remove the protocol (http, https, ftp) and www before length checking
        displayUrl = displayUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/^www\./, '');

        // Shorten the URL if maxLength is set and the URL exceeds it
        if (this.maxLength && displayUrl.length > this.maxLength) {
            displayUrl = `${displayUrl.substring(0, this.maxLength)}...`;
        }

        const targetAttribute = this.linkTarget ? ` target="${this.linkTarget}"` : '';
        return `<a href="${fullUrl}"${targetAttribute}>${displayUrl}</a>`;
    }
}

Redactor.Autoparse = Autoparse;
class Button {
    constructor(app, name, props = {}, toolbar, container) {
        this.app = app;
        this.loc = app.loc;
        this.dom = app.dom;
        this.config = app.config;

        // Local
        this.name = name;
        this.toolbar = toolbar;
        this.container = container || null;

        this._initializeProps(props);

        // Observe
        if (!this._checkObserve() || !this._checkPermissions()) {
            return;
        }

        // Create
        this.toolbarType = this._buildToolbarType();
        this.$button = this._createButton();
        if (this.container) {
            this._buildPosition();
        }
    }

    isButton() {
        return this.$button ? true : false;
    }

    observe() {
        if (this._checkObserve()) {
            this.update({ title: this.title, classname: this.classname, command: this.command, icon: this.icon });
        }
    }

    trigger(e, type) {
        e.preventDefault();
        e.stopPropagation();

        if (this.$button.hasClass('rx-in-dropdown')) {
            this.app.dropdown.close();
            this._hideTooltip();
            return;
        }

        let toolbarType = type || this.$button.data('toolbar');
        if (toolbarType) {
            this.app.ui.setState({ button: this, type: toolbarType });
        }

        this.app.api(this.command, this.params, this, this.name, e);
        this._hideTooltip();
    }

    getName() {
        return this.name;
    }

    getCommand() {
        return this.command;
    }

    getType() {
        return this.toolbar;
    }

    getProp(name) {
        return this[name];
    }

    getRect() {
        return this.$button.rect();
    }

    getTemplate() {
        return this.template;
    }

    getElement() {
        return this.$button;
    }

    getIconElement() {
        return this.$button.find('.rx-button-icon');
    }

    getTitleElement() {
        return this.$button.find('.rx-button-title');
    }

    getShortcutElement() {
        return this.$button.find('.rx-button-shortcut');
    }

    getIcon() {
        const $icon = this.getIconElement();
        return $icon.length ? $icon.html() : '';
    }

    getTitle() {
        return this.title;
    }

    getTitleText() {
        return this.getTitleElement().text();
    }

    setState({ disabled, pressed, active } = {}) {
        if (disabled !== undefined) {
            this.disabled = disabled;
            this.$button.toggleClass('disabled', disabled);
        }
        if (pressed !== undefined) {
            this.pressed = pressed;
            this.$button.toggleClass('pressed', pressed);
            if (pressed) this._clearDisabled();
        }
        if (active !== undefined) {
            this.active = active;
            this.$button.toggleClass('active', active);
            if (active) this._clearDisabled();
        }
    }

    setCommand(command) {
        this.update({ command });
    }

    setTitle(title) {
        this.update({ title });
    }

    setIcon(icon) {
        this.update({ icon });
    }

    setProp(name, value) {
        this[name] = value;
    }

    setColor(color) {
        this._getSvg().attr('fill', color);
    }

    setBackground(color) {
        const utils = new Utils(this.app);
        const fill = utils.getInvertedColor(color);

        this.$button.addClass('rx-button-icon-color');
        this.getIconElement().css({ 'background-color': color });
        this._getSvg().attr('fill', fill);
    }

    resetColor() {
        this._getSvg().removeAttr('fill');
    }

    resetBackground() {
        this.$button.removeClass('rx-button-icon-color');
        this.getIconElement().css('background-color', '');
        this._getSvg().removeAttr('fill');
    }

    update({ name, command, icon, title, shortcut, disabled, active, classname, html, toolbar, position } = {}) {
        if (name !== undefined) this.name = name;
        if (command !== undefined) this.command = command;
        if (icon !== undefined) {
            icon = this._getIconCode(icon);
            this.icon = icon;
            this.getIconElement().html(icon);
        }
        if (title !== undefined) {
            this.title = title;
            this.getTitleElement().html(title);
            this._updateTooltip();
        }
        if (shortcut !== undefined) {
            this.getShortcutElement().html(shortcut);
        }
        if (classname !== undefined) {
            this.classname = classname;
            this.$button.addClass(classname);
        }
        if (html !== undefined) {
            this.html = html;
            this.$button.html(this.icon ? `<span class="rx-button-icon">${this.icon}</span>${html}` : html);
        }
        if (toolbar !== undefined) this.toolbar = toolbar;
        if (position !== undefined) this.position = position;
        if (disabled !== undefined) this.setState({ disabled: disabled });
        if (active !== undefined) this.setState({ active: active });
    }

    // Private methods

    _initializeProps(props) {
        this.props = props;
        this.params = props.params;
        this.command = props.command || null;
        this.icon = props.icon || null;
        this.color = props.color || null;
        this.title = props.title || '';
        this.classname = props.classname || '';
        this.html = props.html || '';
        this.shortcut = props.shortcut || '';
        this.position = props.position || null;
        this.text = props.text || false;
        this.danger = props.danger || false;
        this.template = props.template || false;
        this.observer = props.observer || false;
        this.tooltip = props.tooltip === false ? false : true;

        // States
        this.disabled = props.disabled || false;
        this.pressed = false;
        this.active = props.active || false;
    }

    _getIconCode(icon) {
        if (this.config.is('buttons.icons') && this.config.is('buttons.icons.' + this.name)) {
            icon = this.config.get('buttons.icons.' + this.name);
        }

        return icon;
    }

    _getSvg() {
        return this.$button.find('svg path');
    }

    _buildPosition() {
        if (this.position) {
            this._positionButton(this.position);
        } else {
            this.container.append(this.$button);
        }
    }

    _positionButton(position) {
        const type = Object.hasOwn(position, 'after') ? 'after' : 'before';
        const first = Object.hasOwn(position, 'first');
        const name = position[type];

        if (position === 'first') {
            this.container.prepend(this.$button);
        } else if (position === 'last') {
            this.container.append(this.$button);
        } else if (typeof position === 'object') {
            // check if the button has already been added
            let $current = this._findPosition(this.name);
            if ($current.length > 0) {
                return;
            }

            const $el = this._findPosition(name);
            if ($el) {
                $el[type](this.$button);
            } else {
                this.container[first ? 'prepend' : 'append'](this.$button);
            }
        }
    }

    _findPosition(names) {
        const targets = Array.isArray(names) ? names : [names];
        return targets
            .map(name => this.container.find(`[data-name="${name}"]`))
            .find($element => $element.length) || false;
    }

    _checkPermissions() {
        const instance = this.app.block.get();
        return !(instance && !instance.isAllowedButton(this.name, this.props));
    }

    _checkObserve() {
        if (this.observer) {
            let updatedObj = this._fetchUpdatedObject();
            if (!updatedObj) return false;
            this._initializeProps(updatedObj);
        }

        return true;
    }

    _fetchUpdatedObject() {
        const obj = this.app.api(this.observer, this.props, this.name, this.toolbar);
        return obj ? obj : false;
    }

    _buildToolbarType() {
        if (['toolbar', 'extrabar'].includes(this.toolbar)) {
            return 'toolbar';
        } else if (this.toolbar === 'dropdown') {
            return false;
        }

        return this.toolbar;
    }

    _createButton() {
        const $button = this.classname === 'rx-dropdown-item' ? this.dom('<span>') : this.dom('<a href="#" role="button" tabindex="-1">');
        $button.addClass('rx-button');
        $button.addClass(this.classname);

        if (this.toolbar) {
            $button.addClass('rx-button-' + this.toolbar);
        }

        let html = '';
        if (this.icon) {
            this.icon = this._getIconCode(this.icon);
            html += `<span class="rx-button-icon">${this.icon}</span>`;
        }
        if (this.title) {
            this.title = this.loc.parse(this.title);
            html += `<span class="rx-button-title">${this.title}</span>`;
            $button.attr('aria-label',this.title);
        }
        if (this.shortcut) {
            html += `<span class="rx-button-shortcut">${this.shortcut}</span>`;
        }

        if (this.html) html = this.html;

        $button.html(html);
        $button.toggleClass('disabled', this.disabled);
        $button.toggleClass('active', this.active);
        $button.toggleClass('rx-button-danger', this.danger);
        $button.toggleClass('rx-button-text', this.text);
        $button.data({
            'name': this.name,
            'toolbar': this.toolbarType
        });

        $button.dataset('instance', this);
        $button.on('mouseenter', this._showTooltip.bind(this));
        $button.on('mouseleave', this._hideTooltip.bind(this));
        $button.on('dragstart', e => e.preventDefault());
        $button.on('click', (e) => {
            if (!this.disabled && this.command) {
                this.trigger(e);
            } else {
                e.preventDefault();
            }
        });

        return $button;
    }

    _showTooltip() {
        if (!this.title || !this.tooltip || this.disabled || this.$button.hasClass('pressed') || this.$button.closest('.rx-dropdown, .rx-control').length) {
            return;
        }

        const $tooltip = this.dom('<span class="rx-tooltip">');
        $tooltip.text(this.title);

        this.app.page.getBody().append($tooltip);

        const { offset, dimensions } = this._getButtonDetails(this.$button);
        const tooltipDimensions = this._getTooltipDimensions($tooltip);
        const position = this._calculateTooltipPosition(this.$button, offset, dimensions, tooltipDimensions);

        $tooltip.css({
            top: `${position.top}px`,
            left: `${position.left}px`,
            'z-index': this._calculateTooltipZIndex()
        });
        this.tooltipElement = $tooltip;
    }

    _getButtonDetails($button) {
        return {
            offset: $button.offset(),
            dimensions: { width: $button.width(), height: $button.height() }
        };
    }

    _getTooltipDimensions($tooltip) {
        return {
            width: $tooltip.outerWidth(),
            height: $tooltip.outerHeight()
        };
    }

    _calculateTooltipPosition($button, offset, dimensions, tooltipDimensions) {
        const editorRect = this.app.editor.getRect();
        let top = offset.top + dimensions.height + 2;
        let left = offset.left;

        // Prevent overflow on the right edge
        if (editorRect.right < left + tooltipDimensions.width) {
            left = offset.left + dimensions.width - tooltipDimensions.width;
        }

        // Adjust top position based on context
        if ($button.attr('data-toolbar') === 'context') {
            top = offset.top - tooltipDimensions.height - 2;
        } else if (this.app.dropdown.isPositionTop()) {
            top = offset.top + dimensions.height + 2;
        }

        return { top, left };
    }

    _hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.remove();
            this.tooltipElement = null;
        }
    }

    _updateTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.text(this.title);
        }
    }

    _calculateTooltipZIndex() {
        return this.app.isProp('fullscreen') ? 10002 : 1060;
    }

    _clearDisabled() {
        this.$button.toggleClass('disabled', false);
        this.disabled = false;
    }
}

Redactor.Button = Button;
class KeyAnalyzer {
    constructor(app, e) {
        this.app = app;

        const key = e.which;
        const arrowKeys = [37, 38, 39, 40];
        const alphaKeys = [186, 187, 188, 189, 190, 191, 192, 219, 220, 221, 222];
        const isAlphaKeys = (!e.ctrlKey && !e.metaKey) && ((key >= 48 && key <= 57) || (key >= 65 && key <= 90) || alphaKeys.includes(key));

        this.rules = {
            'ctrl': (e.ctrlKey || e.metaKey),
            'shift': (e.shiftKey),
            'alt': (e.altKey),
            'select': ((e.ctrlKey || e.metaKey) && !e.altKey && key === 65),
            'select-block': ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && key === 65),
            'enter': (key === 13),
            'space': (key === 32),
            'esc': (key === 27),
            'tab': (key === 9 && !e.altKey && !e.ctrlKey && !e.metaKey),
            'delete': (key === 46),
            'backspace': (key === 8),
            'alpha': isAlphaKeys,
            'arrow': (arrowKeys.indexOf(key) !== -1),
            'left': (key === 37),
            'right': (key === 39),
            'up': (key === 38),
            'down': (key === 40),
            'left+right': (key === 37 || key === 39),
            'up+left': (key === 38 || key === 37),
            'down+right': (key === 40 || key === 39)
        }
    }

    is(...names) {
        return names.some(name => this.rules[name]);
    }
}

Redactor.KeyAnalyzer = KeyAnalyzer;
class ClassApplier {
    constructor(app) {
        this.app = app;
        this.config = app.config;
        this.dom = app.dom;
    }

    parse(node = null) {
        const $el = this.dom(node) || this.app.getLayout();
        const classes = this.config.get('classes');

        if (!classes) return;

        ['tags', 'blocks'].forEach(elementType => {
            const elements = classes[elementType];
            if (elements) {
                const selector = this._buildSelector(elementType, elements);
                $el.find(selector).each($node => this._applyClass($node, elementType));
            }
        });
    }

    // Private methods

    _buildSelector(elementType, elements) {
        const selectors = Object.keys(elements);
        return elementType === 'tags' ? selectors.join(',') : selectors.map(type => `[data-rx-type="${type}"]`).join(',');
    }

    _applyClass($node, elementType) {
        const isTag = elementType === 'tags';
        const key = isTag ? $node.tag() : $node.attr('data-rx-type');
        const classes = this.config.get(`classes.${elementType}`);

        if (classes[key]) {
            $node.addClass(classes[key]);
        }
    }
}

Redactor.ClassApplier = ClassApplier;
class Clipboard {
    constructor(app) {
        this.app = app;
    }

    getContent(clipboard) {
        const type = this._determineContentType(clipboard);
        const html = clipboard.getData(type);
        const encoder = new CleanerEncoder(this.app);

        return type === 'text/plain' ? encoder.escapeHtml(html) : html;
    }

    setContent(e, html, text = null) {
        const clipboard = e.clipboardData;

        // Clean and prepare HTML for the clipboard
        html = this._cleanSvgWhitespace(html);
        html = this._prepareHtmlForClipboard(html);

        // Prepare plain text version for the clipboard
        text = this._prepareTextForClipboard(html, text);

        clipboard.setData('text/html', html);
        clipboard.setData('text/plain', text);
    }

    isPlainText(clipboard) {
        const text = clipboard.getData('text/plain');
        const html = clipboard.getData('text/html');

        return !(html && html.trim()) && text !== null;
    }

    isPlainHtml(clipboard) {
        const text = clipboard.getData('text/plain');
        return /<\/?[a-z][\s\S]*>/i.test(text);
    }

    // Private methods

    _cleanSvgWhitespace(html) {
        return html.replace(/(\s*)<svg([^>]*?)>([\s\S]*?)<\/svg>(\s*)/g, (match, p1, p2, p3) => {
            return ' <svg' + p2 + '>' + p3.trim() + '</svg> ';
        });
    }

    _determineContentType(clipboard) {
        return this.isPlainText(clipboard) ? 'text/plain' : 'text/html';
    }

    _prepareHtmlForClipboard(html) {
        const unparser = new Unparser(this.app);
        html = unparser.unparse(html, { clipboard: true });
        return '<meta type="rx-editor"/>' + html;
    }

    _prepareTextForClipboard(html, text) {
        const utils = new Utils(this.app);
        return text || utils.getTextFromHtml(html, { nl: true });
    }
}

Redactor.Clipboard = Clipboard;
class ColorPicker {
    constructor(app, params) {
        this.app = app;
        this.dom = app.dom;
        this.uuid = app.uuid;
        this.loc = app.loc;
        this.config = app.config;
        this.$colorpicker = null;
        this.$dropdown = null;
        this.input = false;

        params.$toggle ? this.build(params) : this.create(params);
    }

    build(params) {
        this.$colorpicker = this._createContainer('rx-colorpicker');
        this._initialize(params, this.$colorpicker);
        this.app.page.getBody().append(this.$colorpicker);
        this._setPosition();
        this._bindGlobalEvents();

        return this.$colorpicker;
    }

    create(params) {
        this.$dropdown = this._createContainer('rx-dropdown-box');
        this._initialize(params, this.$dropdown);
        this.app.page.getDoc().off('.rx-colorpicker');
        this._bindMouseLeaveCheck();
        return this.$dropdown;
    }

    getContainer() {
        return this.params.$toggle ? this.$colorpicker : this.$dropdown;
    }

    isOpen() {
        return !!this.$colorpicker;
    }

    close() {
        this.app.page.getBody().find(`.rx-colorpicker-${this.uuid}`).remove();
        this.app.scroll.getTarget().off('.rx-colorpicker');
        this.app.page.getDoc().off('.rx-colorpicker');
        this.$colorpicker = null;
    }

    // Private methods

    _createContainer(className) {
        return this.dom(`<div class="${className} ${className}-${this.uuid}">`);
    }

    _bindGlobalEvents() {
        this.app.scroll.getTarget().on('resize.rx-colorpicker scroll.rx-colorpicker', this._setPosition.bind(this));
        this.app.page.getDoc().on('click.rx-colorpicker', this.close.bind(this));
        this._bindMouseLeaveCheck();
    }

    _bindMouseLeaveCheck() {
        const checkMouseLeave = (e) => {
            const $swatches = this.getContainer().find('.rx-swatches');
            const isInside = $swatches.length && $swatches.get().contains(e.target);

            if (!isInside) {
                const $layer = this.dom(e.target).closest('.rx-dropdown-layer[data-color]');
                if ($layer.length) {
                    const type = $layer.data('type');
                    const color = $layer.attr('data-color');
                    this._resetColorByType($layer, color, type);
                }
            }
        };

        this.app.page.getDoc().on('mousemove.rx-colorpicker', checkMouseLeave);
    }

    _setPosition() {
        const offset = this.params.$toggle.offset();
        const left = offset.left + this.params.$toggle.width();

        this.$colorpicker.css({
            top: `${offset.top}px`,
            left: `${left}px`,
        });

        this.$colorpicker.toggle(offset.left);
        this.app.ui.buildDepth('colorpicker', this.$colorpicker);
    }

    _initialize(params, $target) {
        const defaults = {
            $toggle: null,
            colors: [],
            method: null,
            style: {},
            name: 'color',
            tabs: false,
            instant: false,
            set: null,
            input: false,
            remove: null
        };

        this.params = { ...defaults, ...params };
        this.currentColor = this.params.style.color || null;
        this.currentBackgroundColor = this.params.style.background || null;

        this.params.tabs ? this._buildTabs($target) : this._buildLayer(this.params.name, $target);
    }

    _buildTabs($target) {
        const $tabs = this.dom('<div class="rx-colorpicker-tabs">');
        this.params.tabs.forEach((tab, index) => {
            const $tab = this.dom('<a href="#">')
                .attr('data-tab', tab)
                .addClass(`rx-colorpicker-tab rx-colorpicker-tab-${tab}`)
                .html(this.loc.get(`colorpicker.${tab}`))
                .toggleClass('active', index === 0)
                .on('click.rx-colorpicker-tab', this._switchTab.bind(this));

            $tabs.append($tab);
            this._buildLayer(tab, $target, index !== 0);
        });

        $target.prepend($tabs);
    }

    _buildLayer(name, $target, hidden = false) {
        const $layer = this.dom(`<div class="rx-dropdown-layer rx-dropdown-layer-${name}" data-type="${name}">`);
        $layer.append(this._buildColorPicker(name));
        this._addInputField($layer, name);
        this._addRemoveButton($layer, name);
        $layer.toggle(!hidden);
        $target.append($layer);
    }

    _switchTab(e) {
        e.preventDefault();
        e.stopPropagation();

        const $target = this.dom(e.target);
        const $dropdown = $target.closest('.rx-dropdown-box');
        const tabName = $target.attr('data-tab');

        // clear hovered color
        $dropdown.find('.rx-dropdown-layer').each($layer => {
            const type = $layer.data('type');
            const color = $layer.attr('data-color');
            this._resetColorByType($layer, color, type);
        });

        this._updateActiveTab($dropdown, tabName);
    }

    _updateActiveTab($dropdown, tabName) {
        $dropdown.find('.rx-dropdown-layer').hide();
        $dropdown.find('.rx-colorpicker-tab').removeClass('active');

        $dropdown.find(`.rx-dropdown-layer-${tabName}`).show();
        $dropdown.find(`.rx-colorpicker-tab[data-tab="${tabName}"]`).addClass('active');
    }

    _getCurrentColor(type) {
        return type === 'color' ? this.currentColor || '' : this.currentBackgroundColor || '';
    }

    _buildColorPicker(name) {
        const $box = this.dom(`<div class="rx-dropdown-color-box rx-dropdown-box-${name}">`);
        const $colorBox = this.dom('<div class="rx-swatches">')
            .toggleClass('rx-swatches-wrap', this.config.get('colorpicker.wrap'))
            .css('max-width', this.config.get('colorpicker.width') || '');

        Object.entries(this.params.colors).forEach(([group, colors]) => {
            const $group = this.dom('<div class="rx-swatches-colors">')
                .toggleClass('rx-swatches-colors-row', this.config.get('colorpicker.row'));

            colors.forEach((color, index) => {
                const $swatch = this._createSwatch(color, name, `${group}-${index}`);
                $group.append($swatch);
            });

            $colorBox.append($group);
        });

        $box.append($colorBox);

        return $box;
    }

    _createSwatch(color, rule, title) {
        return this.dom('<a href="#" tabindex="-1" class="rx-swatch">')
            .attr({ rel: color, 'data-rule': rule, title })
            .addClass(this.config.get('colorpicker.size') ? `rx-swatch-size-${this.config.get('colorpicker.size')}` : '')
            .toggleClass('rx-color-contrast', ['#fff', '#ffffff'].includes(color))
            .toggleClass('active', (rule === 'color' && color === this.currentColor) || (rule === 'background' && color === this.currentBackgroundColor))
            .css({ background: color })
            .on('click', this._applyColor.bind(this))
            .on('mouseover', this._previewColor.bind(this));
    }

    _addInputField($layer, type) {
        if (!this.params.input) return;

        const $input = this.dom(`<input type="text" class="rx-form-input rx-form-input-${type}">`).val(this._getCurrentColor(type));
        const $button = this.dom('<button class="rx-form-button">&rarr;</button>')
            .attr('data-rule', type)
            .on('click', () => this._applyInputColor($input, type));

        const $inputGroup = this.dom('<div class="rx-form-flex">').append($input, $button);
        const $field = this.dom('<div class="rx-form-box">')
            .append(this.dom('<label class="rx-form-label">').html(this.loc.get('colorpicker.set-color')))
            .append($inputGroup);


        $layer.append($field);
        this.input = true;
    }

    _addRemoveButton($layer, type) {
        if (!this.params.remove?.[type]) return;

        const buttonConfig = {
            position: 'last',
            title: this.loc.get(`colorpicker.remove-${type}`),
            command: this.params.remove[type]
        };

        const button = new Button(this.app, 'remove', buttonConfig, 'dropdown');
        $layer.append(button.getElement());
    }

    _previewColor(e) {
        const $el = this.dom(e.target).closest('a');
        const type = $el.data('rule');
        const value = $el.attr('rel');
        const $layer = $el.closest('.rx-dropdown-layer');

        if (this.params.instant) this._applyInstantColor(type, value);
        if (!this.input) return;

        const $input = $layer.find(`.rx-form-input-${type}`);
        if (!$layer.attr('data-color')) {
            $layer.attr('data-color', $input.val() || 'empty');
        }
        $input.val(value);
    }

    _applyColor(e) {
        e.preventDefault();
        e.stopPropagation();

        const $el = this.dom(e.target).closest('a');
        const color = $el.attr('rel');
        const type = $el.data('rule');
        const style = { [type]: color };

        this._executeCallback(color, { tag: 'span', style });
    }

    _applyInstantColor(type, color) {
        const style = { [type]: color };
        this._executeCallback(color, { tag: 'span', style }, true);
    }

    _applyInputColor($input, type) {
        let color = $input.val().trim();
        if (!color) return;

        const utils = new Utils(this.app);
        color = utils.normalizeColor(color);

        this.app.inline.restoreOffset();

        const style = { [type]: color };
        this._executeCallback(color, { tag: 'span', style });
    }

    _executeCallback(color, params, instant = false, skipTool = false) {
        if (this.$dropdown) this.$dropdown.off('.rx-colorpicker');
        if (this.$colorpicker) this.$colorpicker.off('.rx-colorpicker');

        if (this.params.method) {
            this.params.method(color, instant, skipTool);
        } else {
            this.app.api(this.params.set, params, instant, skipTool);
        }
    }

    _resetLayerColor(e) {
        const $target = this.dom(e.target);
        const $layer = $target.closest('.rx-dropdown-layer[data-color]');
        if (!$layer.length) return;

        const type = $layer.data('type');
        const color = $layer.attr('data-color');
        this._resetColorByType($layer, color, type);
    }

    _resetColor(e) {
        const $layer = this.dom(e.target).closest('.rx-dropdown-layer');
        if (!$layer.length) return;

        const type = $layer.data('type');
        const color = $layer.attr('data-color');
        this._resetColorByType($layer, color, type);
    }

    _resetColorByType($layer, color, type) {
        if (!color) return;

        const finalColor = color === 'empty' ? '' : color;
        if (this.params.instant) this._applyInstantColor(type, finalColor);
        $layer.removeAttr('data-color');

        if (this.input) {
            $layer.find(`.rx-form-input-${type}`).val(finalColor);
        }
    }
}

Redactor.ColorPicker = ColorPicker;
class Fragment {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
    }

    create(node) {
        return this.isFragment(node) ? node : this._buildFragment(node);
    }

    isFragment(obj) {
        return !!(obj && typeof obj === 'object' && obj.frag);
    }

    insert(fragment) {
        const selection = new TextRange(this.app);
        const range = selection.getRange();
        if (!range) return;

        this._clearRangeIfCollapsed(range);
        this._insertIntoRange(fragment, range);
    }

    // Private methods

    _buildFragment(content) {
        const container = this._createContainer(content);
        const fragment = document.createDocumentFragment();

        let firstNode = container.firstChild;
        let lastNode = container.lastChild;

        while (container.firstChild) {
            fragment.appendChild(container.firstChild);
        }

        return { frag: fragment, first: firstNode, last: lastNode, nodes: Array.from(fragment.childNodes) };
    }

    _createContainer(content) {
        const $div = this.dom('<div>');
        if (typeof content === 'string') {
            $div.html(content);
        } else {
            $div.append(this.dom(content).clone(true));
        }
        return $div.get();
    }

    _clearRangeIfCollapsed(range) {
        if (range.collapsed) {
            const startContainer = range.startContainer;
            if (startContainer.nodeType !== 3 && startContainer.tagName === 'BR') {
                startContainer.remove();
            }
        } else {
            range.deleteContents();
        }
    }

    _insertIntoRange(fragment, range) {
        range.insertNode(fragment.frag || fragment);
    }
}

Redactor.Fragment = Fragment;
class Offset {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
        this.page = app.page;
    }

    get(el) {
        const node = this._getNode(el);
        const selection = this._getSelection();
        if (!selection || !selection.rangeCount || !node.contains(selection.anchorNode)) {
            return false;
        }

        const range = selection.getRangeAt(0);
        const clonedRange = this._cloneRangeForNode(range, node);
        const start = clonedRange.toString().length;
        const startNode = range.startContainer;
        const inspector = new ElementInspector(this.app);

        let emptyNode = false;
        if (selection.isCollapsed && startNode.nodeType === 1 && startNode.innerText.trim() === '') {
            const block = inspector.getDataBlock(startNode);
            const instance = block.dataget('instance');
            if (block.html().trim() === '' && instance && instance.isType(['heading', 'text', 'listitem', 'pre', 'address'])) {
                const utils = new Utils(this.app);
                const markerNode = utils.createInvisibleChar();
                startNode.appendChild(markerNode);
                emptyNode = true;
            }
        }

        const fix = emptyNode ? 1 : 0;

        return {
            start: start + fix,
            end: start + range.toString().length + fix,
            empty: emptyNode
        };
    }

    set(offset, el) {
        const node = this._getNode(el);
        const range = this._createRangeForOffset(offset, node);
        const selection = this._getSelection();

        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    // Private methods

    _getNode(el) {
        return el ? this.dom(el).get() : this.app.getLayout().get();
    }

    _getSelection() {
        return this?.page?.getWinNode()?.getSelection() ?? false;
    }

    _createRangeForOffset(offset, node) {
        const range = this.page.getDocNode().createRange();
        range.setStart(node, 0);
        range.collapse(true);

        let charIndex = 0;
        let foundStart = false;

        const traverseNodes = (currentNode) => {
            if (currentNode.nodeType === 3) { // Text node
                const nextCharIndex = charIndex + currentNode.length;

                if (!foundStart && offset.start >= charIndex && offset.start <= nextCharIndex) {
                    range.setStart(currentNode, offset.start - charIndex);
                    foundStart = true;
                }

                if (foundStart && offset.end >= charIndex && offset.end <= nextCharIndex) {
                    range.setEnd(currentNode, offset.end - charIndex);
                    return true;
                }

                charIndex = nextCharIndex;
            } else {
                for (let i = 0; i < currentNode.childNodes.length; i++) {
                    if (traverseNodes(currentNode.childNodes[i])) return true;
                }
            }
            return false;
        };

        traverseNodes(node);
        return range;
    }

    _cloneRangeForNode(range, node) {
        const clonedRange = range.cloneRange();
        clonedRange.selectNodeContents(node);
        clonedRange.setEnd(range.startContainer, range.startOffset);
        return clonedRange;
    }
}

Redactor.Offset = Offset;
class Marker {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
        this.page = app.page;
        this.config = app.config;
    }

    create(pos = 'start') {
        return this._buildMarker(pos);
    }

    createHtml(pos = 'start') {
        return this._buildMarker(pos).outerHTML;
    }

    insert(doc = false) {
        this.remove();

        const selection = new TextRange(this.app);
        if (doc) selection.set(window.getSelection());

        const range = selection.getRange();
        if (!range) return;

        const isCollapsed = selection.isCollapsed();
        const startMarker = this._buildMarker('start');
        const endMarker = this._buildMarker('end');
        const clonedRange = range.cloneRange();

        this._insertMarkers(range, clonedRange, startMarker, endMarker, isCollapsed);
        selection.updateRange(range);
    }

    save(doc = false) {
        this.insert(doc);
    }

    restore() {
        const startMarker = this.find('start');
        const endMarker = this.find('end');
        if (!startMarker) return;

        const selection = new TextRange(this.app);
        let range = this._restoreSelection(startMarker, endMarker);
        this._cleanUpMarkers(startMarker, endMarker);
        this.app.editor.setWinFocus();
        selection.setRange(range);
    }

    find(pos = false) {
        const $editor = this.app.getLayout();
        if (!$editor) return false;

        let markers = {
            start: this._getMarkerById($editor, 'start'),
            end: this._getMarkerById($editor, 'end')
        };

        return pos ? markers[pos] : markers;
    }

    findMarkerById(container, idSuffix = 'start') {
        let $marker = this.dom(container).find(`#rx-selection-marker-${idSuffix}`);
        return $marker.length !== 0 ? $marker.get() : false;
    }

    replaceToText(html) {
        const utils = new Utils(this.app);
        return utils.wrap(html, $w => {
            $w.find('#rx-selection-marker-start').replaceWith('---marker-start---');
            $w.find('#rx-selection-marker-end').replaceWith('---marker-end---');
        });
    }

    replaceToMarker(html) {
        const startMarker = this._buildMarker('start').outerHTML;
        const endMarker = this._buildMarker('end').outerHTML;
        return html.replace('---marker-start---', startMarker)
                   .replace('---marker-end---', endMarker);
    }

    remove() {
        this._remove(this.find('start'));
        this._remove(this.find('end'));
    }

    // Private methods

    _insertMarkers(range, clonedRange, startMarker, endMarker, isCollapsed) {
        if (!isCollapsed) {
            clonedRange.collapse(false);
            clonedRange.insertNode(endMarker);
        }

        clonedRange.setStart(range.startContainer, range.startOffset);
        clonedRange.collapse(true);
        clonedRange.insertNode(startMarker);

        range.setStartAfter(startMarker);
        if (!isCollapsed) range.setEndBefore(endMarker);
    }

    _restoreSelection(startMarker, endMarker) {
        const range = this.page.getDocNode().createRange();
        const nextNode = this._getNextNode(startMarker);
        const prevNode = this._getPreviousNode(endMarker);

        this._setRangeBasedOnMarkers(range, startMarker, endMarker, nextNode, prevNode);
        return range;
    }

    _cleanUpMarkers(startMarker, endMarker) {
        this._remove(startMarker);
        this._remove(endMarker);
    }

    _getMarkerById($editor, idSuffix) {
        let $marker = $editor.find(`#rx-selection-marker-${idSuffix}`);
        return $marker.length !== 0 ? $marker.get() : false;
    }

    _remove(marker) {
        if (marker) {
            const parent = this._getParent(marker);
            marker.remove();
            parent?.normalize();
        }
    }

    _buildMarker(pos = 'start') {
        return this.dom('<span>').attr('id', `rx-selection-marker-${pos}`)
               .addClass('rx-selection-marker')
               .html(this.config.get('markerChar'))
               .get();
    }

    _getParent(el) {
        const tags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'div', 'address', 'li', 'ul', 'ol', 'dl', 'td', 'th', 'blockquote'];
        const $parent = this.dom(el).closest(tags.join(','));
        return $parent.length !== 0 ? $parent.get() : false;
    }

    _getNextNode(marker) {
        return marker.nextSibling && marker.nextSibling.nodeType === 3 && marker.nextSibling.textContent.replace(/[\n\t]/g, '') === '' ? false : marker.nextSibling;
    }

    _getPreviousNode(marker) {
        return marker ? marker.previousSibling : false;
    }

    _setRangeBasedOnMarkers(range, startMarker, endMarker, nextNode, prevNode) {
        if (!endMarker) {
            if (nextNode) {
                range.selectNodeContents(nextNode);
                range.collapse(true);
            } else {
                range.selectNodeContents(startMarker);
                range.collapse(false);
            }
        } else if (nextNode && nextNode.id === 'rx-selection-marker-end') {
            range.selectNodeContents(startMarker);
            range.collapse(false);
            range.setStart(nextNode, 0);
        } else {
            range.setStartAfter(startMarker);
            if (endMarker) {
                range.setEndBefore(endMarker);
            }
        }
    }
}

Redactor.Marker = Marker;
class Caret {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;
        this.page = app.page;
    }

    set(el, type) {
        const selection = new TextRange(this.app);
        const node = this._resolveNode(el);
        const range = this.page.getDocNode().createRange();
        const map = {
                  'start': '_setStart',
                  'end': '_setEnd',
                  'before': '_setBefore',
                  'after': '_setAfter'
              };

        if (!type || !node || !this._isInPage(node)) {
            return;
        }

        this.app.editor.setWinFocus();

        // Handle non-editable inline nodes
        if (this._isInline(node) && this._isNoneditable(node)) {
            type = this._adjustTypeForNonEditable(type);
        }


        // Set caret
        this[map[type]](range, node);
        selection.setRange(range);

        // Set block for inline nodes
        this._setBlock(node);
    }

    is(el, type, removeblocks, trimmed, br) {
        const node = this._resolveNode(el);
        const sel = this.page.getWinNode().getSelection();

        if (!node || !sel.isCollapsed) {
            return false;
        }

        const position = this._getPosition(node, trimmed, br);
        const size = this._getSize(node, removeblocks, trimmed);

        return this._comparePositionWithType(position, size, type);
    }

    get(el) {
        let position = 'middle';
        position = this.is(el, 'start') ? 'start' : position;
        position = this.is(el, 'end') ? 'end' : position;

        return position;
    }

    // Private methods

    _resolveNode(el) {
        return this.dom(el).get();
    }

    _adjustTypeForNonEditable(type) {
        return type === 'start' ? 'before' : type === 'end' ? 'after' : type;
    }

    _comparePositionWithType(position, size, type) {
        return type === 'end' ? position === size : type === 'start' ? position === 0 : false;
    }

    _setStart(range, node) {
        this._setRangeStartToNodeStart(range, node);

        if (this._isEmptyLink(node)) {
            this._insertInvisibleNodeBetween(range);
        } else {
            this._handleInlineNodeAtStart(range, node);
        }
    }

    _setRangeStartToNodeStart(range, node) {
        range.setStart(node, 0);
        range.collapse(true);
    }

    _handleInlineNodeAtStart(range, node) {
        let inline = this._getInlineInside(node);
        if (inline) {
            this._setRangeStartInline(range, inline);
        } else if (this._isInline(node)) {
            this._insertInvisibleNode(range);
        }
    }

    _setRangeStartInline(range, inline) {
        const inspector = new ElementInspector(this.app);
        let inlines = inspector.getInlines(inline);
        let node = inlines[0];

        range.selectNodeContents(node);
        range.collapse(true);
    }

    _setEnd(range, node) {
        let last = node.lastChild;
        let lastInline = last && this._isInline(last);

        if (lastInline) {
            const isLastChild = last.childNodes.length === 1 && last.childNodes[0].nodeType === 1;
            if (isLastChild && ['svg', 'br'].includes(last.childNodes[0].tagName.toLowerCase())) {
                this._setAfter(range, last);
            } else {
                range.selectNodeContents(last);
                range.collapse(false);
            }
        } else {
            if (this._isLink(node)) {
                if (this._isEmptyLink(node)) {
                    range.setStart(node, 0);
                    range.collapse(true);
                    this._insertInvisibleNodeBetween(range);
                } else {
                    this._insertInvisibleNode(range, node, 'append');
                }
                return;
            }

            range.selectNodeContents(node);
            range.collapse(false);
        }
    }

    _setBefore(range, node) {
        range.setStartBefore(node);
        range.collapse(true);

        // inline node
        if (this._isInline(node)) {
            this._insertInvisibleNode(range, node);
        }
    }

    _setAfter(range, node) {
        range.setStartAfter(node);
        range.collapse(true);

        // inline node
        let tag = (node.nodeType !== 3) ? node.tagName.toLowerCase() : false;
        if (this._isInline(node) || tag === 'br' || tag === 'svg') {
            this._insertInvisibleNode(range);
        }
    }

    _setBlock(node) {
        if (this._isInline(node)) {
            const selection = new TextRange(this.app);
            const block = selection.getBlockControlled();
            const instance = this.dom(block).dataget('instance');
            if (block && !instance.isInline()) {
                this.app.block.set(instance);
                this.app.observer.observe();
                this.app.editor.setFocus();
            }
        }
    }

    _insertInvisibleNodeBetween(range) {
        const utils = new Utils(this.app);
        const textNodeStart = utils.createInvisibleChar();
        const textNodeSpace = document.createTextNode('');
        const textNodeEnd = utils.createInvisibleChar();

        range.insertNode(textNodeStart);
        range.insertNode(textNodeSpace);
        range.insertNode(textNodeEnd);
        range.selectNodeContents(textNodeSpace);
        range.collapse(false);
    }

    _insertInvisibleNode(range, beforeNode, append = false) {
        const utils = new Utils(this.app);

        let collapse = false;
        const textNode = utils.createInvisibleChar();
        if (beforeNode) {
            if (append) {
                beforeNode.appendChild(textNode);
                collapse = true;
            } else {
                beforeNode.parentNode.insertBefore(textNode, beforeNode);
            }
        } else {
            range.insertNode(textNode);
        }
        range.selectNodeContents(textNode);
        range.collapse(collapse);
    }

    _getInlineInside(node) {
        let current = node.firstChild;

        // Skip line breaks and empty text nodes
        while (current && current.nodeType === 3 && current.nodeValue.trim() === '') {
            current = current.nextSibling;
        }

        // Traverse down to find the deepest nested inline element
        while (current && this._isInline(current)) {
            let next = current.firstChild;

            // Skip line breaks and empty text nodes
            while (next && next.nodeType === 3 && next.nodeValue.trim() === '') {
                next = next.nextSibling;
            }

            if (next && this._isInline(next)) {
                current = next;
            } else {
                return current; // Return the deepest inline element found
            }
        }

        return this._isInline(current) ? current : null;
    }

    _getSize(node, removeblocks, trimmed) {
        const isTextNode = (node.nodeType === 3);

        let str, $node, $cloned;
        if (removeblocks && removeblocks.length !== 0) {
            str = this._removeSpecifiedBlocks(node, removeblocks);
        }
        else {
            str = (isTextNode) ? node.textContent : node.innerHTML;
            str = (isTextNode || trimmed === false) ? str : str.trim();
        }

        return this._trimmed(str, isTextNode, trimmed).length;
    }

    _removeSpecifiedBlocks(node, removeblocks) {
        const $node = this.dom(node).clone();
        const selector = removeblocks.join(',');

        $node.find(selector).remove();
        return $node.html().trim();
    }

    _getPosition(node, trimmed, br) {
        let sel = this.page.getWinNode().getSelection();

        if (sel.rangeCount === 0) {
            return false;
        }

        let range = sel.getRangeAt(0),
            caretRange = range.cloneRange(),
            contentHolder = document.createElement("div"),
            isTextNode = (node.nodeType === 3);

        caretRange.selectNodeContents(node);
        caretRange.setEnd(range.endContainer, range.endOffset);
        contentHolder.appendChild(caretRange.cloneContents());

        let str = (isTextNode || trimmed === false) ? contentHolder.innerHTML : contentHolder.innerHTML.trim();
        let brAdjustment = this._adjustForBr(str, br);

        str = this._trimmed(str, isTextNode, trimmed);

        return str.length + brAdjustment;
    }

    _adjustForBr(content, includeBr) {
        let hasBrAtEnd = /<\/?br\s?\/?>$/i.test(content);
        return includeBr && hasBrAtEnd ? 1 : 0;
    }

    _trimmed(str, isTextNode, trimmed) {
        const utils = new Utils(this.app);

        if (trimmed === false) {
            return str.replace(/\n$/g, '');
        }

        str = utils.removeInvisibleChars(str);
        str = str.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, '');
        str = str.replace(/\s+/g, ' ');
        if (str !== '' && !isTextNode) {
            str = str.replace(/\s$/, '');
        }

        return str;
    }

    _isInline(node) {
        const inspector = new ElementInspector(this.app);
        return inspector.is(node, 'inline');
    }

    _isLink(node) {
        return node.nodeType === 1 && node.tagName === 'A';
    }

    _isEmptyLink(node) {
        return this._isLink(node) && node.innerHTML === '';
    }

    _isInPage(node) {
        return node && node.nodeType && this.page.getDocNode().body.contains(node);
    }

    _isNoneditable(node) {
        return node.getAttribute('contenteditable') === 'false';
    }
}

Redactor.Caret = Caret;
class Paragraphizer {
    constructor(app, setting = true) {
        this.defaults = {
            cleanBreakline: true
        };

        if (setting === false) {
            this.setting = false;
        } else if (typeof setting === 'object') {
            this.setting = { ...this.defaults, ...setting };
        } else {
            this.setting = this.defaults;
        }

        this.app = app;
        this.dom = app.dom;
        this.config = app.config;
        this.remStart = '#####replace';
        this.remEnd = '#####';
        this.tags = ['pre', 'hr', 'ul', 'ol', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'address', 'blockquote', 'style', 'script',
                     'figure', 'iframe', 'form', 'dl', 'div', 'form', 'audio', 'figcaption', 'object',  'select', 'input', 'textarea', 'picture',
                     'button', 'article', 'footer', 'aside', 'section', 'option', 'map', 'area', 'math', 'fieldset', 'legend', 'hgroup', 'nav', 'details', 'menu', 'summary'];
        this.tags = [...this.tags, ...Redactor.customTags];
        this.xmlTags = [];
    }

    parse(html) {
        if (!this.setting) return html;
        html = this._parse(html);
        return this._parseTable(html);
    }

    parseLayers(html) {
        const utils = new Utils(this.app);
        return utils.wrap(html, ($w) => {
            this._parseElementsByType($w, 'wrapper');
            this._parseElementsByType($w, 'column');
        });
    }

    // Private methods

    _parse(html, typemarkup = false) {
        const storage = new CleanerStorage(this.app);
        const breakline = this.config.get('breakline');
        const tag = (breakline || typemarkup) ? 'sdivtag' : this.config.get('markup');
        const attr = typemarkup ? 'tbr' : 'br';
        let stored = [];

        // Store and clean tags and comments
        html = this._handleSelfClosingXmlTags(html);
        html = this._storeXmlTags(html);
        html = this._storeTags(html, stored);
        html = storage.store(html, 'svg');
        html = storage.storeComments(html);

        // Inserts line breaks around paragraph markers if surrounded by text, ignoring extra spaces for proper formatting.
        html = this._addLineBreaksAroundMarkers(html);

        // Trim and clean
        html = this._cleanHtml(html, breakline);

        // Wrap content into the designated tags
        html = this._wrapInTags(html, tag);
        html = this._middleClean(html, tag, breakline);

        // Restore previously stored tags and comments
        html = this._restoreTags(html, stored);
        html = storage.restore(html, 'svg');
        html = storage.restoreComments(html);
        html = this._restoreXmlTags(html);

        html = this._finalClean(html, tag, attr, breakline);

        return html;
    }

    _parseTable(html) {
        const utils = new Utils(this.app);
        return utils.wrap(html, ($w) => {
            $w.find('td, th').each(node => this._parseCell(node));
        });
    }

    _parseCell(node) {
        const $node = this.dom(node);
        const code = this._parse($node.html(), 'table');
        $node.html(code);
    }

    _parseElementsByType($w, type) {
        $w.find('[data-rx-type="' + type + '"]').each(($node) => {
            const code = this._parse($node.html());
            $node.html(code);
        });
    }

    _storeTags(html, stored) {
        const utils = new Utils(this.app);
        return utils.wrap(html, ($w) => {
            $w.find(this.tags.join(', ')).each(($node, i) => {
                this._replaceTag($node, i, stored);
            });
        });
    }

    _addLineBreaksAroundMarkers(html) {
        return html.replace(/([^\n\s])\s*#####replace(\d+)#####xparagraphmarkerz/g, '$1\n#####replace$2#####xparagraphmarkerz')
                   .replace(/(xparagraphmarkerz)\s*([^\n\s])/g, '$1\n$2')
                   .replace(/([^\n\s])\n#####replace(\d+)#####xparagraphmarkerz/g, '$1\n#####replace$2#####xparagraphmarkerz')
                   .replace(/\n\s+/g, '\n');
    }

    _cleanHtml(html, breakline) {
        html = html.trim();
        html = this._trimLinks(html);
        html = html.replace(/xparagraphmarkerz(?:\r\n|\r|\n)$/g, '')
                   .replace(/xparagraphmarkerz$/g, '')
                   .replace(/xparagraphmarkerz(?:\r\n|\r|\n)/g, '\n')
                   .replace(/xparagraphmarkerz/g, '\n');

        if (breakline) {
            html = html.replace(/<br\s?\/?>(?:\r\n|\r|\n)/gi, 'xbreakmarkerz\n')
                       .replace(/<br\s?\/?>/gi, 'xbreakmarkerz\n')
                       .replace(/xbreakmarkerz\n<\//gi, 'xbreakmarkerz</');
        } else {
            html = html.replace(/<br\s?\/?><br\s?\/?>$/gi, '')
                       .replace(/[\n]+/g, '\n')
                       .replace(/<br\s?\/?><br\s?\/?>/g, '\n');
        }

        return html;
    }

    _wrapInTags(html, tag) {
        const arr = html.split("\n");
        let str = '';
        for (let i = 0, max = arr.length; i < max; i++) {
            str += `<${tag}>${arr[i].trim()}</${tag}>\n`;
        }
        return str.replace(/\n$/, '');
    }

    _middleClean(html, tag, breakline) {
        // trim new line at the end
        html = html.replace(/\n$/, '');

        // clean
        html = html.replace(new RegExp('<' + tag + '>\\s+#####', 'gi'), '#####');
        html = html.replace(new RegExp('<' + tag + '>#####', 'gi'), '#####');
        html = html.replace(new RegExp('#####</' + tag + '>', 'gi'), '#####');

        // replace marker
        html = (breakline) ? html.replace(/xbreakmarkerz/gi, "<br>") : html;

        return html;
    }

    _finalClean(html, tag, attr, breakline) {
        // remove empty
        if (breakline) {
            html = html.replace(new RegExp('<' + tag + '></' + tag + '>', 'gi'), '<' + tag + '><br></' + tag + '>');
            html = html.replace(/<\/?br\s?\/?><\/div>/gi, "</div>");
        }

        // clean empty
        html = html.replace(/<(p|h1|h2|h3|h4|h5|h6|li|td|th)(.*?)>[\s\n]*<\/\1>/gi, '<$1$2></$1>');

        // opts: paragraphize: { cleanBreakline: false }
        if (this._is('cleanBreakline')) {
            html = html.replace(/<p(.*?)><\/?br\s?\/?><\/p>/gi, "<p$1></p>");
        }

        html = html.replace(/<div(.*?)><\/?br\s?\/?><\/div>/gi, "<div$1></div>");
        html = html.replace(/<\/?br\s?\/?><\/div>/gi, "</div>");
        html = html.replace(/<\/?br\s?\/?><\/li>/gi, "</li>");
        //html = html.replace(/\s+<\/p>/g, '</p>');

        // clean restored
        html = html.replace(new RegExp('<sdivtag>', 'gi'), '<div data-rx-tag="' + attr + '">');
        html = html.replace(new RegExp('sdivtag', 'gi'), 'div');
        html = html.replace(/<\/([^>]+)><div data-rx-tag/g, '</$1>\n<div data-rx-tag');

        if (breakline) {
            html = html.replace(/<\/?br\s?\/?><\/div>/gi, "</div>");
        }

        return html;
    }

    _restoreTags(html, stored) {
        for (let i = 0; i < stored.length; i++) {
            const str = stored[i].replace(/\$/gi, '&#36;');
            html = html.replace(this.remStart + i + this.remEnd, str);
        }
        return html;
    }

    _handleSelfClosingXmlTags(html) {
        const selfClosingTags = this.config.get('paragraphizer.selfClosingXmlTags');
        if (!selfClosingTags) return html;

        // 1. Remove all closing tags
        selfClosingTags.forEach(tag => {
            const closingTagPattern = new RegExp(`</${tag}>`, 'gi');
            html = html.replace(closingTagPattern, '');
        });


        // 2. Add a closing tag right after the opening tag
        selfClosingTags.forEach(tag => {
            const openTagPattern = new RegExp(`(<${tag}[^>]*?>)`, 'gi');
            html = html.replace(openTagPattern, '$1</' + tag + '>');
        });

        return html;
    }

    _storeXmlTags(html) {
        this.xmlTags = [];
        return html.replace(/<([a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+)([^>]*?)>(.*?)<\/\1>/gis, (match) => {
            const index = this.xmlTags.length;
            this.xmlTags.push({ tag: match });
            return `${this.remStart}xml${index}${this.remEnd}`;
        });
    }
    _restoreXmlTags(html) {
        this.xmlTags.forEach((item, index) => {
            let restoredTag = item.tag;
            html = html.replace(`${this.remStart}xml${index}${this.remEnd}`, restoredTag);
        });

        return html;
    }

    _replaceTag($node, i, stored) {
        const node = $node.get();
        const replacement = document.createTextNode(`${this.remStart}${i}${this.remEnd}xparagraphmarkerz`);
        stored.push(node.outerHTML);
        node.parentNode.replaceChild(replacement, node);
    }

    _trimLinks(html) {
        const utils = new Utils(this.app);
        return utils.wrap(html, ($w) => {
            $w.find('a').each(($node) => {
                $node.html($node.html().trim());
            });
        });
    }

    _is(name) {
        return this.setting[name];
    }
}

Redactor.Paragraphizer = Paragraphizer;
/*jshint esversion: 6 */
class Reorder {
    constructor(app, control, button, $control, instance) {
        if (!button) return;

        this.app = app;
        this.dom = app.dom;
        this.control = control;
        this.$control = $control;
        this.instance = instance;
        this.$button = button.getElement();

        this.$button.on('click.rx-reorder-button', this._pressStop.bind(this));
        this.$button.on('mousedown.rx-reorder-button touchstart.rx-reorder-button', this._press.bind(this));
    }

    // Private methods

    _pressStop(e) {
        e.stopPropagation();
        e.preventDefault();

        clearTimeout(this.dragTimeout);
        this.$button.removeClass('rx-in-dragging');
    }

    _press(e) {
        e.stopPropagation();
        e.preventDefault();

        this.touchStartTime = new Date().getTime();
        this.isDragging = false;

        this.dragTimeout = setTimeout(() => {
            this.isDragging = true;
            this._startDragging();
        }, 200);

        this.$button.on('touchend.rx-reorder-button mouseup.rx-reorder-button', this._checkTap.bind(this));
    }

    _checkTap(e) {
        const touchEndTime = new Date().getTime();
        const touchDuration = touchEndTime - this.touchStartTime;
        const utils = new Utils(this.app);

        if (touchDuration < 200 && !this.isDragging) {
            clearTimeout(this.dragTimeout);
            this._pressStop(e);
            if (utils.isMobileDevice()) {
                this.control.trigger();
            }
        }

        this.$button.off('touchend.rx-reorder-button mouseup.rx-reorder-button', this._checkTap.bind(this));
    }

    _startDragging() {
        this.$button.addClass('rx-in-dragging');
        this._bindWindowEvents();
    }

    _bindWindowEvents() {
        this.app.page.getWin().on('mouseup.rx-reorder-button touchend.rx-reorder-button', this._release.bind(this));
        this.app.page.getWin().on('mousemove.rx-reorder-button touchmove.rx-reorder-button', this._move.bind(this));
    }

    _release(e) {
        if (!this.$button.hasClass('rx-handle')) return;

        this._resetDragState();
        this._setCaretAfterRelease();
    }

    _resetDragState() {
        this.$button.removeClass('rx-handle rx-in-dragging');
        this.app.page.getWin().off('.rx-reorder-button');
        this.app.observer.trigger = true;
        this.oldY = 0;
        this.dragging = false;
        this._trashDragItem();
        this.app.control.updatePosition();
        this.$control.show();
        this.app.ui.closeTooltip();
        this.app.emit('reorder.release');
    }

    _setCaretAfterRelease() {
        setTimeout(() => {
            this.app.block.set(this.instance, 'start', true);
            this.app.event.trigger = true;
        }, 1);
    }

    _move(e) {
        e.preventDefault();

        if (!this.$button.hasClass('rx-in-dragging')) return;

        if (!this.$button.hasClass('rx-handle')) {
            this._initializeDrag(e);
        }

        this.app.dropdown.close();

        const deltaY = this._calculateDeltaY(e.pageY);
        const direction = this._getDirection(deltaY);

        this._moveItem(this.$dragItem, deltaY);
        this.oldY = e.pageY;

        this._handleAutoScroll(e.pageY, direction);

        const $container = this._getContainer();
        this._placeItem($container);
    }

    _initializeDrag(e) {
        const item = this.instance.getBlock().get();

        this.$button.addClass('rx-handle');
        this.dragging = true;
        this.$dragItem = this._makeDragItem(item, e.target);
        this.$control.hide();
        this.app.event.trigger = false;
    }

    _getDirection(deltaY) {
        if (deltaY > 0) return 'up';
        if (deltaY < 0) return 'down';
        return false;
    }

    _calculateDeltaY(pageY) {
        return this.oldY === 0 ? 0 : this.oldY - pageY;
    }

    _handleAutoScroll(point, direction) {
        const { topStop, bottomStop, topEdge, bottomEdge } = this._getScrollBoundaries();

        if (this._isScrollUp(point, topStop, topEdge, direction)) {
            this._scroll(-10);
        } else if (this._isScrollDown(point, bottomStop, bottomEdge, direction)) {
            this._scroll(10);
        }
    }

    _getContainer() {
        const containers = ['list', 'todo', 'cell', 'column', 'wrapper'];
        const target = this.instance.getClosest(containers);

        return (target) ? target.getBlock() : this.app.editor.getLayout();
    }

    _getScrollBoundaries() {
        const editorPos = this.app.editor.getRect();
        const scrollTop = this.app.page.getDoc().scrollTop();
        const tolerance = 40;

        let topStop = scrollTop > editorPos.top ? scrollTop + tolerance : editorPos.top + tolerance;
        let bottomStop = this.app.page.getWin().height() + scrollTop - tolerance;
        let topEdge = editorPos.top;
        let bottomEdge = editorPos.top + this.app.editor.getEditor().height();

        if (this.app.scroll.isTarget()) {
            const $target = this.app.scroll.getTarget();
            const targetOffset = $target.offset();

            topEdge = targetOffset.top;
            topStop = scrollTop > editorPos.top ? targetOffset.top + tolerance : topStop;
            bottomEdge = targetOffset.top + $target.height();
            bottomStop = bottomEdge - tolerance;
        }

        return { topStop, bottomStop, topEdge, bottomEdge };
    }

    _isScrollUp(point, topStop, topEdge, direction) {
        return direction === 'up' && point < topStop && point > topEdge;
    }

    _isScrollDown(point, bottomStop, bottomEdge, direction) {
        return direction === 'down' && point > bottomStop && point < bottomEdge;
    }

    _placeItem($container) {
        const $elms = $container.children();
        const max = $elms.length;

        for (let b = 0; b < max; b++) {
            const subItem = $elms.eq(b).get();
            const $subItem = this.dom(subItem);

            if (subItem === this.$clickItem.get()) continue;

            if (this._isOver($subItem)) {
                this._swapItems(subItem);
            }
        }
    }

    _isOver($target) {
        const y = this.$dragItem.offset().top;
        const offset = $target.offset();
        const height = $target.height();

        return y > offset.top && y < offset.top + height;
    }

    _scroll(step) {
        const $target = this.app.scroll.isTarget() ? this.app.scroll.getTarget() : this.app.page.getWin();
        const scrollY = $target.scrollTop();

        $target.scrollTop(scrollY + step);
    }

    _swapItems(target) {
        const y = this.$dragItem.offset().top;
        const $item = this.$clickItem;
        const $target = this.dom(target);
        const offset = $target.offset();
        const height = $target.height() / 2;
        const func = height + offset.top > y ? 'before' : 'after';

        $target[func]($item);
    }

    _moveItem($item, deltaY) {
        const top = $item.offset().top - deltaY;
        $item.css('top', `${top}px`);
        this.$control.css('top', `${top}px`);
    }

    _makeDragItem(item) {
        this._trashDragItem();

        const $item = this.dom(item);
        const offset = $item.offset();
        const theme = this.app.editor.getTheme();

        this.$clickItem = $item;
        this.$clickItem.addClass('rx-drag-active');

        const $cloned = $item.clone();
        $cloned.removeClass('rx-drag-active rx-element-active');
        $cloned.css({
            'font-family': $item.css('font-family'),
            'font-size': $item.css('font-size'),
            'line-height': $item.css('line-height'),
            'margin': 0,
            'padding': 0
        });

        const $dragItem = this.dom('<div>').addClass('rx-dragging');
        $dragItem.append($cloned);
        $dragItem.attr('rx-data-theme', theme);
        $dragItem.css({
            'opacity': 0.95,
            'position': 'absolute',
            'z-index': 999,
            'left': offset.left + 'px',
            'top': offset.top + 'px',
            'width': $item.width() + 'px'
        });

        this.app.page.getFrameBody().append($dragItem);

        return $dragItem;
    }

    _trashDragItem() {
        if (this.$dragItem && this.$clickItem) {
            this.$clickItem.removeClass('rx-drag-active');
            this.$clickItem = null;

            this.$dragItem.remove();
            this.$dragItem = null;
        }
    }
}

Redactor.Reorder = Reorder;
class Tidy {
    constructor(app) {
        this.app = app;

        // local
        this.cleanlevel = 0;
        this.encoder = new CleanerEncoder(this.app);
    }

    // @deprecated 5.0
    parse(code, type) {
        return this.format(code, type);
    }

    format(code, type) {
        code = this.encoder.encodeAttrSings(code);

        // Step 1: extract <pre> blocks
        const preBlocks = [];
        code = code.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, match => {
            const key = `__PRE_BLOCK_${preBlocks.length}__`;
            preBlocks.push(match);
            return key;
        });

        // clean setup
        const ownLine = ['li', ...(type === 'email' ? ['style', 'meta'] : [])];
        const contOwnLine = ['li'];
        const newLevel = [
            'p', 'ul', 'ol', 'li', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'blockquote', 'figure', 'figcaption', 'table', 'thead', 'tbody',
            'tfoot', 'tr', 'td', 'th', 'dl', 'dt', 'dd',
            ...(type === 'email' ? ['title', 'head', 'body'] : [])
        ];

        this.lineBefore = new RegExp(`^<(/?${ownLine.join('|/?')}|${contOwnLine.join('|')})[ >]`);
        this.lineAfter = new RegExp(`^<(/?${ownLine.join('|/?')}|/${contOwnLine.join('|/')})[ >]`);
        this.newLevel = new RegExp(`^</?(${newLevel.join('|')})[ >]`);

        const codeLength = code.length;
        let start = null, end = null, tag = '', cont = '';
        let i = 0, point = 0, out = '';
        for (; i < codeLength; i++) {
            point = i;

            if (-1 === code.substr(i).indexOf('<')) {
                out += code.substr(i);

                return this.finish(out, preBlocks);
            }

            while (point < codeLength && code.charAt(point) !== '<') {
                point++;
            }

            if (i !== point) {
                cont = code.substr(i, point - i);
                if (!cont.match(/^\s{2,}$/g)) {
                    if ('\n' === out.charAt(out.length - 1)) out += this.getTabs();
                    else if ('\n' === cont.charAt(0)) {
                        out += '\n' + this.getTabs();
                        cont = cont.replace(/^\s+/, '');
                    }

                    out += cont;
                }
            }

            start = point;

            // find the end of the tag
            while (point < codeLength && '>' !== code.charAt(point)) {
                point++;
            }

            tag = code.substr(start, point - start);
            i = point;

            let t;

            if ('!--' === tag.substr(1, 3)) {
                if (!tag.match(/--$/)) {
                    while ('-->' !== code.substr(point, 3)) {
                        point++;
                    }
                    point += 2;
                    tag = code.substr(start, point - start);
                    i = point;
                }

                if ('\n' !== out.charAt(out.length - 1)) out += '\n';

                out += this.getTabs();
                out += tag + '>\n';
            }
            else if ('!' === tag[1]) {
                out = this.placeTag(tag + '>', out);
            }
            else if ('?' === tag[1]) {
                out += tag + '>\n';
            }
            else if (t === tag.match(/^<(script|style|pre)/i)) {
                t[1] = t[1].toLowerCase();
                tag = this.cleanTag(tag);
                out = this.placeTag(tag, out);
                end = String(code.substr(i + 1)).toLowerCase().indexOf('</' + t[1]);

                if (end) {
                    cont = code.substr(i + 1, end);
                    i += end;
                    out += cont;
                }
            }
            else {
                tag = this.cleanTag(tag);
                out = this.placeTag(tag, out);
            }
        }

        out = this.finish(out, preBlocks);

        return out.replace(/\n\s*<pre/gi, '\n<pre');
    }

    _restorePreBlocks(code, preBlocks) {
        let result = code;
        preBlocks.forEach((block, i) => {
            result = result.replace(`__PRE_BLOCK_${i}__`, block);
        });
        return result;
    }

    getTabs() {
        let s = '';
        for (let i = 0; i < this.cleanlevel; i++ ) {
            s += '    ';
        }

        return s;
    }

    finish(code, preBlocks) {
        this.cleanlevel = 0;
        code = code
            .replace(/\n\s*\n/g, '\n')
            .replace(/^[\s\n]+|[\s\n]+$/g, '')
            .replace(/<li(.*?)>\s*/gi, '<li$1>')
            .replace(/<(p|h1|h2|h3|h4|h5|h6|li|td|th)(.*?)>\s*<\/\1>/gi, '<$1$2></$1>')
            .replace(/\s*<\/li>/gi, '</li>')
            .replace(/<script(.*?)>\n<\/script>/gi, '<script$1></script>')
            .replace(/\n(.*?)<link(.*?)><style/gi, '\n$1<link$2>\n$1<style')
            .replace(/><link/gi, '>\n<link')
            .replace(/><\/head/gi, '>\n</head>');

        let out = this.encoder.decodeAttrSings(code);
        out = this._restorePreBlocks(out, preBlocks);

        return out;
    }

    cleanTag(tag) {
        let tagout = '', suffix = '', m;

        tag = tag.replace(/\n/g, ' ');
        tag = tag.replace(/\s{2,}/g, ' ');
        tag = tag.replace(/^\s+|\s+$/g, ' ');

        // if (tag.match(/\/$/)) {
        //     suffix = '/';
        //     tag = tag.replace(/\/+$/, '');
        // }
        const selfClosingMatch = tag.match(/(\s*\/)$/);
        if (selfClosingMatch) {
            suffix = selfClosingMatch[1];
            tag = tag.replace(/\s*\/+$/, '');
        }

        while (m = /\s*([^= ]+)(?:=((['"']).*?\3|[^ ]+))?/.exec(tag)) {
            if (m[2]) tagout += m[1].toLowerCase() + '=' + m[2];
            else if (m[1]) tagout += m[1].toLowerCase();

            tagout += ' ';
            tag = tag.substr(m[0].length);
        }

        return tagout.replace(/\s*$/, '') + suffix + '>';
    }

    placeTag(tag, out) {
        const isNewLevel = this.newLevel.test(tag);

        if (this.lineBefore.test(tag) || isNewLevel) {
            out = out.trimEnd() + '\n';
        }

        if (isNewLevel && '/' === tag.charAt(1)) this.cleanlevel--;
        if (out.endsWith('\n')) out += this.getTabs();
        if (isNewLevel && '/' !== tag.charAt(1)) this.cleanlevel++;

        out += tag;

        if (this.lineAfter.test(tag) || isNewLevel) {
            out = out.trimEnd() + '\n';
        }
        return out;
    }
}

Redactor.Tidy = Tidy;
class Uploader {
    static defaults = {
        type: 'image',
        box: false,
        url: false,
        cover: true,
        name: 'file',
        data: false,
        multiple: true,
        placeholder: false,
        progress: true,
        hidden: true,
        target: false,
        success: false,
        error: false,
        remove: false,
        trigger: false,
        input: false,
    };

    constructor(app, { element = false, params = {}, trigger = null }) {
        this.app = app;
        this.dom = app.dom;
        this.ajax = app.ajax;
        this.config = app.config;
        this.progress = app.progress;

        // local
        this.eventname = 'rx-upload';
        this.p = { ...Uploader.defaults, ...params, trigger };

        if (element) {
            this._build(element);
        }
    }

    send(e, files = e?.dataTransfer?.files) {
        const data = this._buildFormData(files);
        const utils = new Utils(this.app);

        if (this.config.get('image.upload') === 'base64') {
            this._convertFilesToBase64(files, (response) => {
                this.complete(response, e);
            });
        } else {
            this._sendData(e, files, utils.extendData(data, this.p.data));
        }
    }

    complete(response, e) {
        if (response?.error) {
            this._setStatus('error');
            this.p.error && this.app.api(this.p.error, response, e);
        } else {
            this._removeStatus();
            this._trigger(response);
            this.p.success && this.app.api(this.p.success, response, e);
        }
        setTimeout(() => this.progress.hide(), 500);
    }

    setImage(url) {
        if (this.p.input) return;

        this.$image?.remove();
        this.$removeBtn?.remove();

        if (url === '') {
            this.$placeholder?.show();
        } else {
            this.$placeholder?.hide();
            this._buildImage(url);
            if (this.p.remove) this._buildRemove();
        }
    }

    _build($el) {
        this.$element = this.dom($el);

        if (this.$element.tag('input')) {
            this._buildByInput();
        } else {
            this._buildByBox();
        }
    }

    _buildByInput() {
        this.$input = this.$element;

        if (this.p.box) {
            this._buildBox();
            this._buildPlaceholder();
        } else {
            this.p.input = true;
        }

        this._buildAccept();
        this._buildMultiple();
        this._buildEvents();
    }

    _buildByBox() {
        this._buildInput();
        this._buildAccept();
        this._buildMultiple();
        this._buildBox();
        this._buildPlaceholder();
        this._buildEvents();
    }

    _buildBox() {
        this.$box = this.dom('<div>').addClass('rx-form-upload-box');
        this.$element.before(this.$box);

        if (!this.p.cover) this.$box.addClass('rx-form-upload-cover-off');
        if (this.p.hidden) this.$element.hide();
    }

    _buildPlaceholder() {
        if (!this.p.placeholder) return;

        this.$placeholder = this.dom('<span>')
            .addClass('rx-form-upload-placeholder')
            .html(this.p.placeholder);
        this.$box.append(this.$placeholder);
    }

    _buildImage(url) {
        this.$image = this.dom('<img>').attr('src', url);
        this.$box.append(this.$image);

        if (!this.p.input) {
            this.$box.off(`click.${this.eventname}`);
            this.$image.on(`click.${this.eventname}`, this._click.bind(this));
        }
    }

    _buildRemove() {
        this.$removeBtn = this.dom('<span>')
            .addClass('rx-upload-remove')
            .on('click', this._removeImage.bind(this));
        this.$box.append(this.$removeBtn);
    }

    _buildInput() {
        this.$input = this.dom('<input>').attr({
            type: 'file',
            name: this.p.name,
        });
        this.$input.hide();
        this.$element.before(this.$input);
    }

    _buildAccept() {
        if (this.p.type === 'image') {
            const types = this.config?.get('image.types')?.join(',') || '';
            this.$input.attr('accept', types);
        }
    }

    _buildMultiple() {
        if (this.p.multiple) {
            this.$input.attr('multiple', 'multiple');
        } else {
            this.$input.removeAttr('multiple');
        }
    }

    _buildEvents() {
        const events = [
            ['click', this._click.bind(this)],
            ['drop', this._drop.bind(this)],
            ['dragover', this._dragover.bind(this)],
            ['dragleave', this._dragleave.bind(this)],
        ];

        events.forEach(([event, handler]) => {
            this.$box?.on(`${event}.${this.eventname}`, handler);
        });

        this.$input.on(`change.${this.eventname}`, this._change.bind(this));
    }

    _removeImage(e) {
        e?.preventDefault();
        e?.stopPropagation();

        this.$image?.remove();
        this.$removeBtn?.remove();
        this.$placeholder?.show();

        if (!this.p.input) {
            this.$box.on(`click.${this.eventname}`, this._click.bind(this));
        }

        if (e && this.p.remove) {
            this.app.api(this.p.remove, e);
        }
    }

    _buildFormData(files) {
        const data = new FormData();
        const name = this.p.name;

        if (this.p.multiple === 'single') {
            data.append(name, files[0]);
        } else if (this.p.multiple) {
            Object.values(files).forEach(file => data.append(`${name}[]`, file));
        } else {
            data.append(`${name}[]`, files[0]);
        }

        return data;
    }

    _sendData(e, files, data) {
        const { url } = this.p;

        if (typeof url === 'function') {
            url(this, { data, files, e });
        } else {
            this.progress.show();
            this.ajax.post({
                url: url,
                data: data,
                before: (xhr) => {
                    const event = this.app.broadcast('upload.before.send', { xhr, data, files, e });
                    if (event.isStopped()) {
                        this.progress.hide();
                        return false;
                    }
                },
                success: (response) => this.complete(response, e),
                error: (response) => this.complete(response, e),
            });
        }
    }

    _setStatus(status) {
        if (!this.p.input && this.p.box) {
            this._removeStatus();
            this.$box.addClass(`rx-form-upload-${status}`);
        }
    }

    _removeStatus() {
        if (!this.p.input && this.p.box) {
            ['hover', 'error'].forEach((status) =>
                this.$box.removeClass(`rx-form-upload-${status}`)
            );
        }
    }

    _click(e) {
        e.preventDefault();
        this.$input.click();
    }

    _change(e) {
        this.send(e, this.$input.get().files);
    }

    _drop(e) {
        e.preventDefault();
        this.send(e);
    }

    _dragover(e) {
        e.preventDefault();
        this._setStatus('hover');
    }

    _dragleave(e) {
        e.preventDefault();
        this._removeStatus();
    }

    _trigger(response) {
        if (this.p.trigger?.instance && this.p.trigger?.method && response?.url) {
            const { instance, method } = this.p.trigger;
            instance[method]?.(response.url);
        }
    }

    _convertFilesToBase64(files, callback) {
        const promises = Array.from(files).map(file => {
            return new Promise((resolve, reject) => {
                if (!file.type.startsWith('image/')) {
                    resolve(null);
                    return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                    this._convertToWebP(reader.result, (webpBase64) => {
                        resolve({
                            name: file.name.replace(/\.\w+$/, '.webp'),
                            url: webpBase64,
                            base64: true
                        });
                    });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        Promise.all(promises).then(results => {
            callback(results.filter(Boolean));
        });
    }

    _convertToWebP(base64, callback) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            canvas.toBlob(blob => {
                const reader = new FileReader();
                reader.onloadend = () => callback(reader.result);
                reader.readAsDataURL(blob);
            }, 'image/webp', 0.8);
        };
        img.src = base64;
    }
}

Redactor.Uploader = Uploader;
class Utils {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;
    }

    // Device Detection
    isMobileDevice() {
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
        const userAgent = navigator.userAgent.toLowerCase();
        return hasTouch || /mobile|android|iphone|ipad|tablet|blackberry|phone/i.test(userAgent);
    }

    isFirefox() {
        return /firefox/i.test(navigator.userAgent);
    }

    // Invisible Characters
    createInvisibleChar() {
        return document.createTextNode(this.config.get('markerChar'));
    }

    searchInvisibleChars(str) {
        return str.search(/^\uFEFF$/g);
    }

    removeInvisibleChars(str) {
        return str.replace(/\uFEFF/g, '');
    }

    // HTML Manipulations
    wrap(html, func) {
        html = this._sanitizeImages(html);

        const $wrapper = this.dom('<div>').html(html);
        func($wrapper);
        const result = $wrapper.html();
        $wrapper.remove();
        return this._restoreImageSrcs(result);
    }

    _sanitizeImages(html) {
        return html.replace(/<img\s+[^>]*?>/gi, (imgTag) => {
            let updated = imgTag;
            updated = updated.replace(/\s+src=(["'])(.*?)\1/i, ' data-state-src="$2"');
            updated = updated.replace(/\s+srcset=(["'])(.*?)\1/i, ' data-state-srcset="$2"');
            return updated;
        });
    }

    _restoreImageSrcs(html) {
        return html
            .replace(/<img\b([^>]*?)data-state-src=["']([^"']+)["']([^>]*?)>/gi,
                     '<img$1src="$2"$3>')
            .replace(/<img\b([^>]*?)data-state-srcset=["']([^"']+)["']([^>]*?)>/gi,
                     '<img$1srcset="$2"$3>');
    }

    // empty
    isEmptyHtml(html, emptyParagraph) {
        const remover = new CleanerRemover(this.app);

        html = remover.removeInvisibleChars(html.trim());
        html = html.replace(/^&nbsp;$/gi, '1');
        html = html.replace(/&nbsp;/gi, '');
        html = html.replace(/<\/?br\s?\/?>/g, '');
        html = html.replace(/\s/g, '');
        html = html.replace(/^<p>\s\S<\/p>$/i, '');
        html = html.replace(/<hr(.*?[^>])>$/i, 'hr');
        html = html.replace(/<iframe(.*?[^>])>$/i, 'iframe');
        html = html.replace(/<source(.*?[^>])>$/i, 'source');

        // Remove comments and empty tags
        html = remover.removeComments(html);
        if (emptyParagraph) {
            html = html.replace(/<p[^>]*><\/p>/gi, '').replace(/<div[^>]*><\/div>/gi, '');
        }
        html = html.replace(/<[^/>]><\/[^>]+>/gi, '');
        html = html.replace(/<[^/>]><\/[^>]+>/gi, '');
        html = html.trim();

        return (html === '');
    }

    isLine(html, type) {
        if (this.config.is('breakline')) return false;

        const $el = this.dom('<div>').html(html);
        const tags = this.config.get('tags.block');
        const isSingleLine = $el.find([...tags, 'img'].join(',')).length === 0;
        const hasDivBr = /div><br\s?\/?><div/i.test(html);
        const hasDoubleBr = /<br\b[^>]*>\s*<br\b[^>]*>/i.test(html);

        if (this.isPlainText(html) && /\n\n/.test(html)) return false;
        if (hasDoubleBr || hasDivBr) return false;
        if (isSingleLine && type === 'paste' && /\n\n/.test(html)) return false;

        return isSingleLine;
    }

    isPlainText(html) {
        const blockTags = this.config.get('tags.block');
        const regex = new RegExp(`</?(${blockTags.join('|')})\\b[^>]*>`, 'i');
        return !regex.test(html);
    }


    decodeEntities(html) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = html;
        return textarea.value;
    }

    // HTML Extraction
    extractHtmlFromCaret(el) {
        const node = this.dom(el).get();
        const selection = new TextRange(this.app);
        const range = selection.getRange();

        if (range) {
            const cloned = range.cloneRange();
            cloned.selectNodeContents(node);
            cloned.setStart(range.endContainer, range.endOffset);
            return cloned.extractContents();
        }

        return null;
    }

    getTextFromHtml(html, params = {}) {
        const storage = new CleanerStorage(this.app);
        const encoder = new CleanerEncoder(this.app);

        // Default parameters
        const defaults = {
            br: false,
            nl: false,
            trimlines: true,
            images: false,
            links: false,
            decode: true
        };

        params = { ...defaults, ...params };

        // Store sensitive content
        html = storage.store(html, 'code');
        if (params.links) html = storage.store(html, 'links');
        if (params.images) html = storage.store(html, 'images');

        // Cleanup and normalize HTML
        html = this._cleanHtml(html);

        // Convert to plain text
        const $tmp = this.dom('<div>').html(html);
        html = this.getText($tmp.get());


        // Trim lines if required
        if (params.trimlines) {
            html = html
                .split('\n')
                .map(line => line.trim())
                .join('\n');
        }

        // Normalize newlines
        html = this._normalizeNewlines(html, params);

        // Restore stored content
        html = storage.restore(html, 'code');
        if (params.links) html = storage.restore(html, 'links');
        if (params.images) html = storage.restore(html, 'images');

        if (params.decode) {
            html = encoder.decodeEntitiesInsidePreAndCode(html);
            html = encoder.decodeEntities(html);
        }

        // Final cleanup
        html = this._removeUnwantedTags(html, params);

        return html.trim();
    }

    getText(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.nodeValue;
        }

        let result = '';
        for (const child of node.childNodes) {
            result += this.getText(child);
        }

        // Add newline for block-level elements
        const display = node.nodeType === Node.ELEMENT_NODE
            ? getComputedStyle(node).getPropertyValue('display')
            : '';
        if (/^block|list/.test(display) || ['BR', 'HR'].includes(node.tagName)) {
            result += '\n';
        }

        return result;
    }

    // Todo Tags
    findTodoItemTag() {
        const $div = this.dom('<div>').html(this.config.get('todo.templateContent'));
        return $div.children().first().tag();
    }

    // check svg
    isOnlySvgContent(el) {
        el = this._getNode(el);

        const children = Array.from(el.childNodes);
        let foundContent = false;
        for (let node of children) {
            if (node.nodeType === 3) {
                if (node.nodeValue.trim() !== '') return false;
                if (foundContent) return false;
            } else if (node.nodeType === 1) {
                if (node.tagName.toLowerCase() === 'svg') {
                    foundContent = true;
                } else if (node.tagName.toLowerCase() === 'span' && node.children.length === 1 && node.firstElementChild.tagName.toLowerCase() === 'svg') {
                    foundContent = true;
                } else {
                    return false;
                }
            }
        }

        return foundContent;
    }

    hasSvgAt(el, position) {
        el = this._getNode(el);

        const children = position === 'start' ? Array.from(el.childNodes) : Array.from(el.childNodes).reverse();
        for (let node of children) {
            if (node.nodeType === 3) {
                if (node.nodeValue.trim() !== '') return false;
            } else if (node.nodeType === 1) {
                if (node.tagName.toLowerCase() === 'svg') return node;
                if (node.tagName.toLowerCase() === 'span' && node.children.length === 1 &&
                    node.firstElementChild.tagName.toLowerCase() === 'svg') {
                    return node;
                }

                return false;
            }
        }

        return false;
    }

    // parse
    parseMarkdown(text) {
        const headerRegex = /^(#{1,6})\s+(.*)$/;
        const imageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g;
        const linkRegex = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g;

        return text
            .split('\n')
            .map(line => {
                // Headers
                const headerMatch = line.match(headerRegex);
                if (headerMatch) {
                    const level = headerMatch[1].length;
                    const headerText = headerMatch[2];
                    return `<h${level}>${headerText}</h${level}>`;
                }

                // Lists
                line = line.replace(/^(\-|\d\.)\s?(.*)$/g, (match, symbol, content) => {
                    const tag = symbol === '-' ? 'ul' : 'ol';
                    return `<${tag}><li>${content}</li></${tag}>`;
                });

                // Images
                line = line.replace(imageRegex, (match, altText, url, title) => {
                    const titleAttr = title ? ` title="${title}"` : '';
                    return `<img src="${url}" alt="${altText}"${titleAttr}>`;
                });

                // Links
                line = line.replace(linkRegex, (match, linkText, url, title) => {
                    const titleAttr = title ? ` title="${title}"` : '';
                    return `<a href="${url}"${titleAttr}>${linkText}</a>`;
                });

                return line;
            })
            .join('\n')
            .replace(/<\/ul>\n<ul>|<\/ol>\n<ol>/g, '');
    }

    // Array Manipulations
    extendArrayWithoutDuplicates(arr, extend) {
        return [...new Set([...arr, ...extend])];
    }

    extendArray(arr, extend = []) {
        return [...arr, ...extend];
    }

    removeFromArrayByValue(arr, val) {
        const values = Array.isArray(val) ? val : [val];
        return arr.filter(item => !values.includes(item));
    }

    // CSS Utilities
    cssToObject(str) {
        return str ? Object.fromEntries(
            [...str.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)].map(([_, key, value]) => [
                key.trim(),
                this._normalizeCssValue(key, value.trim())
            ])
        ) : {};
    }

    // Color
    getInvertedColor(hex) {
        hex = this._normalizeHexInput(hex, '#ffffff');
        hex = this._removeHash(hex);

        const [r, g, b] = this._hexToRgb(hex);

        // Calculate luminance and return appropriate color
        return (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? 'black' : 'white';
    }

    normalizeColor(color) {
        if (!color) return color;

        color = this.convertRgbToHex(color);
        color = this.convertShortHexToLong(color);

        return color;
    }

    convertRgbToHex(color) {
        if (!/^rgb/i.test(color)) return color;

        const match = color.match(/^rgba?[\s+]?\((\d+),\s*(\d+),\s*(\d+)/i);

        return match
            ? `#${[match[1], match[2], match[3]]
                  .map(c => parseInt(c, 10).toString(16).padStart(2, '0'))
                  .join('')}`
            : '';
    }

    convertShortHexToLong(hex) {
        hex = this._removeHash(hex);
        return hex.length === 3
            ? `#${[...hex].map(c => c + c).join('')}`
            : `#${hex}`;
    }

    replaceRgbToHex(html) {
        return html.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, (_, r, g, b) => {
            const hex = [r, g, b]
                .map(c => parseInt(c, 10).toString(16).padStart(2, '0'))
                .join('');
            return `#${hex}`;
        });
    }

    // Escaping
    escapeRegExp(s) {
        return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    escapeBackslash(s) {
        return s.replace(/\//g, '/');
    }

    // Data Manipulations
    extendData(data, obj) {
        for (let key in obj) {
            data = key === 'elements' ?  this._extendDataElements(data, obj[key]) : this._setData(data, key, obj[key]);
        }

        return data;
    }

    // Random Utilities
    getRandomId(length = 12) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    }

    // Private methods

    _getNode(el) {
        return this.dom(el).get();
    }

    _extendDataElements(data, elements) {
        this.dom(elements).each($node => {
            if ($node.tag('form')) {
                Object.entries($node.serialize(true)).forEach(([key, value]) => {
                    data = this._setData(data, key, value);
                });
            } else {
                const name = $node.attr('name') || $node.attr('id');
                data = this._setData(data, name, $node.val());
            }
        });
        return data;
    }

    _setData(data, name, value) {
        if (data instanceof FormData) {
            data.append(name, value);
        } else {
            data[name] = value;
        }
        return data;
    }

    _normalizeCssValue(key, val) {
        val = (typeof val === 'string') ? val.replace(/'/g, '"') : val;
        val = val.trim().replace(/;$/, '');
        if (/color|background/.test(key)) val = this.convertRgbToHex(val).toLowerCase();
        if (/family/.test(key)) val = val.replace(/"/g, '');
        if (key === 'border') {
            const match = val.match(/rgb\((.*?)\)/gi);
            if (match) {
                val = val.replace(match[0], this.convertRgbToHex(match[0]));
            }
        }

        return val;
    }

    _normalizeHexInput(hex, defaultColor) {
        return hex || defaultColor;
    }

    _removeHash(hex) {
        return hex.startsWith('#') ? hex.slice(1) : hex;
    }

    _hexToRgb(hex) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return [r, g, b];
    }

    _cleanHtml(html) {
        return html
            .replace(/\n\s+<span/gi, ' <span')
            .replace(/span>\n\s+/gi, 'span> ')
            .replace(/<(ul|ol)>\s+<li>/gi, '<$1><li>')
            .replace(/<li[^>]*>\n/gi, '<li$1>')
            .replace(/<p[^>]*>(\s+|)<\/p>/gi, 'xemptyz')
            .replace(/<!--[\s\S]*?-->/gi, '')
            .replace(/<style[\s\S]*?style>/gi, '')
            .replace(/<script[\s\S]*?script>/gi, '')
            .replace(/<\/(div|li|dt|dd|td|p|H[1-6])>\n?/gi, '</$1>\n')
            .replace(/&(lt|gt);/gi, 'x$1z');
    }

    _normalizeNewlines(html, params) {
        html = html.replace(/[\n]+/g, '\n').replace(/xemptyz/g, '\n').replace(/x(lt|gt)z/gi, '&$1;');

        if (params.br) {
            html = html.replace(/\n/g, '<br>\n').replace(/<br\s?\/?>\n?$/gi, '');
        } else if (!params.nl) {
            html = html.replace(/\n/gi, ' ');
        }

        return html;
    }

    _removeUnwantedTags(html, params) {
        if (!params.images) {
            html = html.replace(/<img[\s\S]*?>/gi, '').replace(/<a[^>]*>(\s+|)<\/a>/gi, '');
        }

        return html
            .replace(/<pre[^>]*>/g, '')
            .replace(/<code[^>]*>/g, '')
            .replace(/<\/pre>\n?/g, '')
            .replace(/<\/code>/g, '');
    }
}

Redactor.Utils = Utils;
/*jshint esversion: 6 */
Redactor.add('mixin', 'block', {
    commonDefaults: {
        uid: { getter: 'getUid', setter: 'setUid' },
        time: { getter: 'getTime', setter: 'setTime', trigger: 'updateTime' },
        id: { getter: 'getId', setter: 'setId' },
        style: { getter: 'getStyle', setter: 'setStyle' },
        classname: { getter: 'getClassname', setter: 'setClassname' },
        attrs: { getter: 'getAttrs', setter: 'setAttrs' },
        placeholder: { getter: 'getPlaceholder', setter: 'setPlaceholder' },
        noneditable: { getter: 'getNoneditable', setter: 'setNoneditable' },
    },
    init(source, params, render) {
        // create element
        if (source instanceof Dom || source instanceof Element) {
            this.element = source;
            this.params = params;
        }
        else {
            this.params = source;
        }

        this.renderDataBlock = render;
        this.params = (this.params) ? this.params : {};

        if (this.start) this.start();
        this.render();
    },
    render() {
        // data create
        this._createData(this.params);

        // parse
        if (this.element) {
            this.$block = this.dom(this.element);
            if (this.parse) this.parse();
        }
        // build
        else {
            this.element = this.create();
            this.$block = this.element;
            if (this.build) this.build();
        }

        // data build
        this.data.build();

        // stop render for non parse block like noneditable, embed
        if (this.renderDataBlock === false) {
            return;
        }

        // render attrs
        let attrs = this.$block.attr('data-rx-attrs');
        if (attrs) {
            attrs = attrs.replace(/'/g, '"');
            this.setAttrs(JSON.parse(attrs));
            this.$block.removeAttr('data-rx-attrs');
        }

        // render inline blocks
        this._renderInlineBlocks();

        // render props
        this.$block.dataset('instance', this);
        this.$block.attr('data-rx-type', this.getType());

        // inline
        if (this.isInline()) {
            this.$block.attr('data-rx-inline', true);
        }

        // editable
        if (this.isEditable()) {
            this.$block.attr('contenteditable', true);
        }
        else if (this.isEditable() === false) {
            this.$block.attr('contenteditable', false);
        }

        // nondeletable
        if (this.isNondeletable() || this.isNondeletableParent()) {
            this.$block.attr('contenteditable', false);
        }

        // focusable
        if (this.isFocusable()) {
            this.$block.attr('data-rx-focusable', true);
        }
    },
    trigger(mutation) {
        let triggers = this._buildTriggers();

        // call
        for (let [key, item] of Object.entries(triggers)) {
            let arr = item.trigger.split('.');
            if (arr.length === 1) {
                this[item.trigger].apply(this);
            }
            else {
                this.app.api(item.trigger, this);
            }
        }
    },

    // is
    isAllowedButton(name, obj) {
        let blocks = obj.blocks,
            type = this.getType();

        // all
        if (typeof obj.blocks === 'undefined') {
            return true;
        }

        // except
        if (blocks.except && blocks.except.indexOf(type) !== -1) {
            return false;
        }

        // modes
        if (blocks.all) {
            if (blocks.all === true || blocks.all === 'all') return true;
            else if (blocks.all === 'editable' && this.isEditable()) return true;
            else if (blocks.all === 'first-level' && this.isFirstLevel()) return true;
            else if (blocks.all === 'noneditable' && this.isType('noneditable')) return true;
        }

        // types
        if ((Array.isArray(blocks.types) && blocks.types.indexOf(type) !== -1)) {
            return true;
        }

        return false;
    },
    isFocusable() {
        return (typeof this.props.focusable !== 'undefined');
    },
    isInline() {
        return this.props.inline;
    },
    isEditable() {
        return this.props.editable;
    },
    isNondeletable() {
        return this.$block.attr('data-noneditable');
    },
    isNondeletableParent() {
        return this.$block.closest('[data-noneditable=true]').length !== 0;
    },
    isType(type) {
        let types = (Array.isArray(type)) ? type : [type];
        return (types.indexOf(this.props.type) !== -1);
    },
    isFigure() {
        return (this.getTag() === 'figure');
    },
    isFirstLevel() {
        return this.$block.attr('data-rx-first-level');
    },
    isEmpty(trim, emptyinline) {
        return this._isEmpty(this.$block, trim, emptyinline);
    },
    isParent() {
        return this.props.parent;
    },
    isLastElement() {
        return true;
    },
    isAllSelected() {
        if (this.isEditable()) {
            const selection = new TextRange(this.app);
            return selection.isFullySelected(this.$block);
        }
        else {
            return true;
        }
    },
    isCaretStart() {
        const caret = new Caret(this.app);
        const selection = new TextRange(this.app);

        let current, $item, $prev;
        if (this.isType(['list', 'todo'])) {
            if (!selection.is()) return true;

            // check if the item is the first
            current = selection.getCurrent();
            $item = this.dom(current).closest('li');
            $prev = $item.prevElement();
            if ($prev.length === 0) {
                return caret.is(this.$block, 'start');
            }
            else {
                return false;
            }
        }
        else if (this.isEditable()) {
            return caret.is(this.$block, 'start');
        }

        return true;
    },
    isCaretEnd() {
        const caret = new Caret(this.app);

        if (this.isType('address')) {
            return caret.is(this.$block, 'end', false, true, false);
        }
        else if (this.isEditable() || this.isType(['todo', 'list'])) {
            return caret.is(this.$block, 'end');
        }


        return true;
    },
    isReorder() {
        return (this.props.reorder === false) ? false : true;
    },
    isContext() {
        return this.props.context;
    },

    // has
    hasTime() {
        return this.$block.attr('data-time');
    },
    hasUid() {
        return this.$block.attr('data-uid');
    },

    // find
    findPreviousElement() {
        const container = this.app.editor.getLayout().get();
        let node = this.$block.get();
        let prevElement = node.previousElementSibling;

        while (!prevElement && node.parentElement) {
            node = node.parentElement;
            prevElement = node.previousElementSibling;
        }

        if (prevElement && container.contains(prevElement)) {
            return this.dom(prevElement)?.dataget('instance');
        }

        return null;
    },
    findNextElement() {
        const container = this.app.editor.getLayout().get();
        let node = this.$block.get();
        let nextElement = node.nextElementSibling;

        while (!nextElement && node.parentElement) {
            node = node.parentElement;
            nextElement = node.nextElementSibling;
        }

        if (nextElement && container.contains(nextElement)) {
            return this.dom(nextElement)?.dataget('instance');
        }

        return null;
    },

    // get
    getTitle() {
        let type = this.getType(),
            titles = this.lang.get('blocks'),
            title = this.$block.attr('data-title');

        title = (typeof titles[type] !== 'undefined') ? titles[type] : title;
        title = (title) ? title : (type.charAt(0).toUpperCase() + type.slice(1));

        return title;
    },
    getProp(name) {
        return (typeof this.props[name] !== 'undefined') ? this.props[name] : null;
    },
    getType() {
        return this.props.type;
    },
    getTag() {
        return this.$block.tag();
    },
    getBlock() {
        return this.$block;
    },
    getJson() {
        return this.data.getData(true);
    },
    getOuterHtml() {
        return this.$block.outer();
    },
    getHtml() {
        return this.$block.html();
    },
    getPlainText() {
        return this._getPlainText(this.$block);
    },
    getOffset() {
        return this.$block.offset();
    },
    getFirstLevel() {
        let $el = this.$block.closest('[data-rx-first-level]').last();
        if ($el.length !== 0) {
            return $el.dataget('instance');
        }

        return false;
    },
    getClosest(type) {
        let $el = this.$block.parent().closest(this._buildTraverseSelector(type));

        return ($el.length !== 0) ? $el.dataget('instance') : false;
    },
    getNextParent() {
        let parent = (this.isType('todoitem')) ? this.getClosest(['todo']) : this.getClosest(['table', 'wrapper', 'layout']);
        let next = false;
        if (parent) {
            next = parent.getNext();
        }

        return next;
    },
    getPrevParent() {
        let parent = (this.isType('todoitem')) ? this.getClosest(['todo']) : this.getClosest(['table', 'wrapper', 'layout']);
        let prev = false;
        if (parent) {
            prev = parent.getPrev();
        }

        return prev;
    },
    getParent() {
        let prop = this.props.parent,
            $el;

        if (typeof prop !== 'undefined') {
            $el = this.$block.parent().closest(this._buildTraverseSelector(prop));
        }
        else {
            $el = this.$block.parent().closest('[data-rx-type]');
        }

        return ($el && $el.length !== 0) ? $el.dataget('instance') : false;
    },
    getFirst(type) {
        type = (type) ? '=' + type : '';

        let $el = this.$block.find('[data-rx-type' + type + ']').first();
        if ($el.length !== 0) {
            return $el.dataget('instance');
        }

        return false;
    },
    getLast(type) {
        type = (type) ? '=' + type : '';

        let $el = this.$block.find('[data-rx-type' + type + ']').last();
        if ($el.length !== 0) {
            return $el.dataget('instance');
        }

        return false;
    },
    getNext(type) {
        let $el = this.$block.nextElement();
        return ($el.length !== 0 && $el.is(this._buildTraverseSelector(type))) ? $el.dataget('instance') : false;
    },
    getPrev(type) {
        let $el = this.$block.prevElement();

        return ($el.length !== 0 && $el.is(this._buildTraverseSelector(type))) ? $el.dataget('instance') : false;
    },
    getControl() {
        return (this.isInline()) ? false : this.props.control;
    },
    getToolbar() {
        return this.props.toolbar;
    },
    getExtrabar() {
        return this.props.extrabar;
    },
    getButtons(type) {
        return this.props[type];
    },
    getPlaceholder() {
        return this.$block.attr('data-placeholder');
    },
    getId() {
        return this.$block.attr('id');
    },
    getStyle() {
        const utils = new Utils(this.app);
        const style = this.$block.attr('style');
        const obj = utils.cssToObject(style);

        if (this.isType('column')) {
            delete obj['flex-basis'];
        }

        return (Object.keys(obj).length !== 0) ? obj : null;
    },
    getAttrs() {
        const attrs = {};
        if (this.params.attrs) {
            for (let key of Object.keys(this.params.attrs)) {
                attrs[key] = this.$block.data(key);
            }
        } else {
            const el = this.$block.get();
            for (const attr of el.attributes) {
                if (attr.name.startsWith('data-') && !attr.name.startsWith('data-rx-')) {
                    const key = attr.name.slice(5);
                    attrs[key] = attr.value;
                }
            }
        }

        return (Object.keys(attrs).length !== 0) ? attrs : null;
    },
    getAttr(name) {
        return (this.params.attrs && this.params.attrs[name]) ? this.params.attrs[name] : null;
    },
    getClassname(items) {
        if (items) {
            for (let [key, val] of Object.entries(items)) {
                if (this.$block.hasClass(val)) {
                    return key;
                }
            }
            return 'none';
        } else {
            const excluded = new Set([
                'rx-block-placeholder',
                'rx-block-focus',
                'rx-layout-grid',
                'rx-block-control-focus',
                'data-rx-parsed',
                'data-rx-first-level',
                'data-rx-inline',
                'data-rx-focusable'
            ]);

            const filtered = this.$block.get().classList
                ? [...this.$block.get().classList].filter(cls => !excluded.has(cls)).join(' ')
                : this.$block.attr('class');

            return (filtered && filtered.trim()) ? filtered : null;
        }
    },
    getContent() {
        let $clone = this.$block.clone();
        $clone = this.unparseInlineBlocks($clone);
        $clone = this.unparseInlineStyle($clone);

        return $clone.html().trim();
    },
    getChildren() {
        let $children = this.$block.children(),
            children = [],
            instance,
            data;

        $children.each(function($node) {
            instance = $node.dataget('instance');
            if (instance) {
                children.push(instance.getJson());
            }
        });

        return children;
    },
    getUid() {
        return this.$block.attr('data-uid');
    },
    getTime() {
        let value = this.$block.attr('data-time');
        return (value === true || value === false) ? null : value;
    },
    getData(assembly) {
        return this.data.getData(assembly);
    },
    getNoneditable() {
        return this.$block.data('noneditable');
    },
    get(name) {
        return this.data.get(name);
    },

    // set
    set(name, value) {
        this.data.set(name, value);
    },
    setData(data) {
        this.data.setData(data);
    },
    setEmpty(emptyinline) {
        if (this.isType('todoitem')) {
            this.$content.html('');
        }
        else {
            if (emptyinline) {
                let $inline = this.$block.find(this.opts.get('tags.inline').join(',')).first();
                if ($inline.length !== 0) {
                    $inline.html('');
                    return;
                }
            }

            this.$block.html('');
        }
    },
    setContent(value) {
        this.$block.html(value);
    },
    setId(value) {
        this._setAttr(this.$block, 'id', value);
    },
    setStyle(value) {
        const cache = new CleanerCache(this.app);

        this.$block.css(value);
        if (this.$block.attr('style') === '') {
            this.$block.removeAttr('style');
        }

        cache.cacheElementStyle(this.$block);
    },
    setClassname(value, items) {
        if (items) {
            this._removeObjClasses(items);
        }

        if (value !== 'none') {
            this.$block.addClass(value);
        }
    },
    setAttr(name, value) {
        this.params.attrs = this.params.attrs || {};
        this.params.attrs[name] = value;
        this.$block.attr(name, value, true);
    },
    setAttrs(value) {
        if (!value) return;
        for (let [key, item] of Object.entries(value)) {
            this.setAttr(key, item);
        }
    },
    setUid(value) {
        this._setAttr(this.$block, 'data-uid', value);
    },
    setTime(value) {
        this._setAttr(this.$block, 'data-time', value);
    },
    setPlaceholder(value) {
        this._setAttr(this.$block, 'data-placeholder', value);
    },
    setCaret(point) {
        const caret = new Caret(this.app);
        caret.set(this.$block, point);
    },
    setNoneditable(value) {
        this._setAttr(this.$block, 'data-noneditable', value);
    },

    // update
    updateTime() {
        if (this.hasTime()) {
            this.setTime((new Date()).getTime());
        }
    },

    // generate
    generateUid() {
        return Date.now().toString(36) + Math.floor(Math.pow(10, 12) + Math.random() * 9*Math.pow(10, 12)).toString(36);
    },

    // duplicate
    duplicate(empty) {
        let type = this.getType();
        let $clone = this.$block.clone();

        $clone.removeClass('rx-block-focus');
        $clone.removeAttr('data-rx-type');

        // render inside clone
        this._renderInsideClone($clone);

        // make it empty
        if (empty) {
            $clone.html('');
        }

        let instance = this.app.create('block.' + type, $clone);
        this._renderInlineBlocks(instance.getBlock(), true);

        return instance;
    },
    duplicateEmpty() {
        return this.duplicate(true);
    },

    // remove
    removeAttr(name) {
        if (this.params.attrs && this.params.attrs[name]) {
            delete this.params.attrs[name];
        }

        this.$block.removeAttr(name);
    },
    removeData(name) {
        this.data.remove(name);
    },
    removeCaption() {
        if (this.figcaption) {
            this.$figcaption.remove();
            this.figcaption = false;
            this.$figcaption = false;
        }
    },
    remove(params) {
        let defs = {
            traverse: false,
            broadcast: false
        };
        let type = this.getType();
        let parent = (this.isInline()) ? this.getParent() : false;

        // params
        params = Redactor.extend({}, defs, params);

        // traverse
        if (params.traverse) {
            this._removeTraverse();
        }
        else {
            this.app.broadcast('block.before.remove', { type: type, instance: this });

            // remove
            this.$block.remove();

            // set parent for inline
            if (parent) {
                this.app.block.set(parent);
            }
        }

        // broadcast
        if (params.broadcast) {
            this.app.broadcast('block.remove', { type: type });
        }
    },
    removeClasses(items) {
        this._removeObjClasses(items);
    },

    // insert
    insert(params) {
        this._compositionCutting();
        const insertion = new Insertion(this.app);
        let defs = {
            instance: false,
            position: 'after',
            caret: false,
            remove: true,
            type: 'add',
            current: this
        };

        // set params
        params = Redactor.extend({}, defs, params);

        // insert
        let inserted = insertion.insert(params);

        // broadcast
        if (params.type === 'add') {
            this.app.broadcast('block.add', { inserted: inserted });
        }

        if (this._isIOS()) {
            inserted.getBlock().focus();
        }

        // return
        return inserted;
    },
    insertEmpty(params) {
        params = params || {};
        params.instance = this.app.block.create();

        return this.insert(params);
    },

    _compositionCutting() {
        if (!this._isIOS()) return;
        const beforeActive = document.activeElement;
        document.querySelector('#rxCompositionCutter' + this.uuid).focus({ preventScroll: true });
        beforeActive.focus({ preventScroll: true });
    },

    _isIOS() {
        // Check user agent for iOS devices
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        return /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    },

    // change
    change(newInstance, broadcast) {
        let $newBlock = newInstance.getBlock();

        this.$block.after($newBlock);
        this.$block.remove();

        // rebuild
        this.app.editor.build();

        // set
        this.app.block.set($newBlock);

        // broadcast
        if (broadcast !== false) {
            this.app.broadcast('block.change', { instance: newInstance });
        }
    },

    // move
    move(direction) {
        let target = (direction === 'up') ? this.getPrev() : this.getNext(),
            func = (direction === 'up') ? 'before' : 'after',
            $block;

        if (!target) return;

        // save selection
        if (this.isEditable()) {
            this.app.editor.save(this.getBlock());
        }

        // move
        $block = target.getBlock();
        $block[func](this.getBlock());

        // set force
        this.app.block.set(this, false, true);

        // restore selection
        if (this.isEditable()) {
           this.app.editor.restore(false);
        }
    },

    // append
    appendNext() {
        let next = this.getNext();
        if (!next) return;
        let html = next.getHtml(),
            type = this.getType(),
            nextType = next.getType(),
            insert = true,
            remove = true,
            $item,
            $blocks,
            checkinline = true;

        // nondeletable
        if (next.isNondeletable()) {
            return;
        }

        // next empty
        if (next.isEmpty()) {
            next.remove();
            return;
        }
        // current empty
        else if (this.isEmpty()) {
            this.remove();
            this.app.block.set(next, 'start');
            return;
        }

        // not empty
        // code
        if (type === 'pre' && nextType !== 'pre') {
            html = next.getPlainText();
        }

        // next type
        if (nextType === 'list') {
            if (type === 'list') {
                var $items = next.getBlock().children();
                this.$block.append($items);

                insert = false;
                remove = true;
            }
            else {
                html = this._appendListHtml(next.getBlock(), html);
                remove = next.isEmpty();
            }
        }

        // append
        if (insert) {
            if (nextType === 'dlist' && type === 'dlist') {
                $blocks = next.getBlock().children();
                this.$block.append($blocks);
                next.remove();
                return;
            }
            else if (nextType === 'dlist') {
                html = this._appendDlistHtml(html);
            }
            else if (nextType === 'todo') {
                $item =  next.getFirstItem();
                html = next.getFirstContent().html();
                $item.remove();
                remove = next.isEmpty();
            }
            else if (nextType === 'pre') {
                html = next.getContent();
                checkinline = false;
            }
            else if (nextType === 'quote') {
                html = next.getPlainText();
            }

            this._insertHtml(html, checkinline);
        }

        // remove
        if (remove) {
            next.remove();
        }

    },
    appendToPrev() {
        const caret = new Caret(this.app);
        let prev = this.getPrev(),
            prevType = prev.getType(),
            html = this.getHtml(),
            type = this.getType(),
            insert = true,
            remove = true,
            $blocks,
            checkinline = true;

        // nondeletable
        if (prev.isNondeletable()) {
            return;
        }

        // current empty
        if (this.isEmpty()) {
            this.remove();
            this.app.block.set(prev, 'end');
            return;
        }
        // prev empty
        else if (prev.isEmpty()) {
            prev.remove();
            return;
        }

        // not empty
        // code
        if (type !== 'pre' && prevType === 'pre') {
            html = this.getPlainText();
        }

        // current type
        if (type === 'list') {
            if (prevType === 'list') {
                var $items = this.getBlock().children();
                this.app.block.set(prev, 'end');
                prev.getBlock().append($items);

                insert = false;
                remove = true;
            }
            else {
                html = this._appendListHtml(this.getBlock(), html);
                remove = this.isEmpty();
            }
        }
        if (type === 'dlist') {
            html = this._appendDlistHtml(html);
        }


        // append
        if (insert) {

            checkinline = (prevType === 'todo') ? false : checkinline;
            checkinline = (prevType === 'pre') ? false : checkinline;

            if (type === 'dlist' && prevType === 'dlist') {
                $blocks = this.$block.children();
                prev.getBlock().append($blocks);
                caret.set($blocks.first(), 'start');
                this.remove();
                return;
            }
            else if (type === 'quote') {
                html = this.$block.text();
            }


            // set
            this.app.block.set(prev, 'end');
            this._insertHtml(html, checkinline);
        }

        // remove
        if (remove) {
            this.remove();
        }
    },

    // parse
    parseItems(selector, type) {
        this.$block.find(selector).each(function($node) {
            if (!$node.attr('data-rx-type')) {
                this.app.create('block.' + type, $node);
            }
        }.bind(this));
    },
    parseCaption() {
        let $figcaption = this.$block.find('figcaption');
        if ($figcaption.length !== 0) {
            this.figcaption = this.app.create('block.figcaption', $figcaption);
            this.$figcaption = this.figcaption.getBlock();
        }
    },

    // unparse
    unparseInlineBlocks($el) {
        $el.find('[data-rx-inline]').removeAttr('data-rx-type data-rx-inline contenteditable tabindex').removeClass('rx-block-focus');
        if ($el.attr('class') === '') {
            $el.removeAttr('class');
        }

        return $el;
    },
    unparseInlineStyle($el) {
        $el.find('[data-rx-style-cache]').removeAttr('data-rx-style-cache');

        return $el;
    },

    // =private
    _buildCaption(caption) {
        if (this.isFigure() && caption) {
            let $figcaption = this.$block.find('figcaption');
            if ($figcaption.length !== 0) {
                this.figcaption = this.app.create('block.figcaption', $figcaption, { content: caption });
                this.$figcaption = this.figcaption.getBlock();
            }
            else {
                this.figcaption = this.app.create('block.figcaption', { content: caption });
                this.$figcaption = this.figcaption.getBlock();
                this.$block.append(this.$figcaption);
            }
        }
    },
    _buildTraverseSelector(type) {
        let selector;
        if (Array.isArray(type)) {
            selector = '[data-rx-type=' + type.join('],[data-rx-type=') + ']';
        }
        else {
            type = (type) ? '=' + type : '';
            selector = '[data-rx-type' + type + ']';
        }

        return selector;
    },
    _buildTriggers() {
        let triggers = Redactor.extend(true, {}, Redactor.triggers),
            data = this.data.dump();

        for (let [key, item] of Object.entries(data)) {
            if (item.trigger) {
                triggers[key] = { trigger: item.trigger };
            }
        }

        return triggers;
    },
    _setAttr($el, name, value) {
        if (value === '') {
            $el.removeAttr(name);
        }
        else {
            $el.attr(name, value);
        }
    },
    _createData(params) {
        this.data = new BlockData(this, this.defaults, this.commonDefaults, params);
    },
    _createInstance(type, props) {
        return this.app.create('block.' + type, props);
    },
    _renderInlineBlocks($el, force) {
        if (this.isType('noneditable')) return;

        $el = $el || this.$block;
        $el.find('[' + this.opts.get('dataBlock') + ']').each(function($node) {
            if (!force && $node.attr('data-rx-type')) return;

            let type = $node.attr(this.opts.get('dataBlock'));
            this.app.create('block.' + type, $node);

        }.bind(this));
    },
    _renderInsideClone($el) {
        $el.find('[data-rx-type]').each($node => {
            let type = $node.attr('data-rx-type');
            this.app.create('block.' + type, $node);
        })
    },
    _isEmpty(el, trim, emptyinline) {
        let $el = this.dom(el);
        let text = $el.text();
        const utils = new Utils(this.app);
        let brs = $el.find('br').length;
        let svgs = $el.find('svg').length;

        // clean
        text = utils.removeInvisibleChars(text);
        text = text.replace(/\r?\n/g, '');
        if (trim) {
            text = text.trim();
        }

        if (emptyinline && text === '') {
            let $inline = $el.find(this.opts.get('tags.inline').join(',')).first();
            if ($inline.length !== 0) {
                return false;
            }
        }

        return (text === '' && svgs === 0 && brs < 2);
    },
    _insertHtml(html, checkinline) {
        const caret = new Caret(this.app);
        const selection = new TextRange(this.app);
        const insertion = new Insertion(this.app);
        const inline = selection.getInlineTop();

        if (checkinline !== false && inline) {
            // set caret after inline
            caret.set(inline, 'after');
        }

        // insert
        insertion.insertHtml(html, 'start');
    },
    _appendListHtml($target, html) {
        const remover = new CleanerRemover(this.app);
        const $item = $target.find('li').first();

        html = $item.html().trim();
        html = html.replace(/<\/li>/gi, '</li><br>');
        html = html.replace(/<(ul|ol)/gi, '<br><$1');
        html = remover.removeTags(html, ['ul', 'ol', 'li']);
        html = html.trim();
        html = html.replace(/<br\s?\/?>$/gi, '');

        $item.remove();

        return html;
    },
    _appendDlistHtml(html) {
        const utils = new Utils(this.app);
        return utils.wrap(html, function($w) {
            $w.find('dt, dd').unwrap();
        }.bind(this));
    },
    _getPlainText($el) {
        const marker = new Marker(this.app);
        const utils = new Utils(this.app);

        let html = $el.html();

        html = marker.replaceToText(html);
        html = utils.getTextFromHtml(html, { nl: true });
        html = marker.replaceToMarker(html);

        return html;
    },
    _buildObjClasses(obj) {
        let classes = [];
        for (let val of Object.values(obj)) {
            classes.push(val);
        }

        return classes;
    },
    _removeObjClasses(obj) {
        let classes = this._buildObjClasses(obj);

        this.$block.removeClass(classes.join(' '));
        this.$block.removeEmptyAttr('class');
    },
    _removeTraverse() {

        let next = this.getNext();
        let prev = this.getPrev();
        let parent = this.getClosest(['wrapper', 'todo', 'list']);
        let parentNeverEmpty = this.getClosest(['column', 'cell']);

        // remove
        this.$block.remove();

        // parent
        if (parent && parent.isEmpty(true)) {
            next = parent.getNext();
            prev = parent.getPrev();
            parent.remove();
        }

        // never empty
        if (parentNeverEmpty && parentNeverEmpty.isEmpty(true)) {
            let emptyBlock = this.app.block.create();
            parentNeverEmpty.insert({ instance: emptyBlock, position: 'append' });
            this.app.block.set(emptyBlock, 'start');
            return;
        }

        if (next) {
            this.app.block.set(next, 'start');
        }
        else if (prev) {
            this.app.block.set(prev, 'end');
        }
        else {
            this.app.block.unset();
        }
    }
});
class BlockData {
    constructor(block, defaults, commonDefaults, params) {
        this.block = block;
        this.data = Redactor.extend(true, defaults, commonDefaults);
        this._initializeData(params);
    }

    build() {
        Object.entries(this.data).forEach(([key, item]) => {
            if (item.value && item.setter && typeof this.block[item.setter] === 'function') {
                this.block[item.setter](item.value);
            }
        });
    }

    dump() {
        return this.data;
    }

    is(name) {
        return !!this.get(name);
    }

    get(name) {
        return this.data[name]?.value;
    }

    set(name, value) {
        if (!this.data[name]) {
            this.data[name] = {};
        }
        this.data[name].value = value;
    }

    add(name, obj) {
        if (!Array.isArray(this.data[name])) {
            this.data[name] = [];
        }
        this.data[name].push(obj);
    }

    remove(name) {
        delete this.data[name];
    }

    setData(data) {
        Object.entries(data).forEach(([key, value]) => {
            if (this.data[key] && this.data[key].setter) {
                this.block[this.data[key].setter](value);
            }
        });
    }

    getData(assembly) {
        let data = { type: this.block.getType() };
        Object.entries(this.data).forEach(([key, item]) => {
            if (assembly !== true && (key === 'items' || key === 'children')) {
                return;
            }

            if (assembly && item.getter === 'getHtml' && key === 'text') {
                item.getter = 'getContent';
            }

            if (item.getter && typeof this.block[item.getter] === 'function') {
                let value = this.block[item.getter].apply(this.block);
                if (value !== null) {
                    data[key] = value;
                }
            }
        });

        return data;
    }

    getValues() {
        return Object.entries(this.data)
            .filter(([, item]) => item.value !== undefined)
            .reduce((result, [key, item]) => {
                result[key] = item.value;
                return result;
            }, {});
    }

    // Private methods

    _initializeData(params) {
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                this.set(key, value);
            });
        }
    }
}

Redactor.BlockData = BlockData;
class Insertion {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;
    }

    set(params) {
        return this.insert(params, 'set');
    }

    setEmpty() {
        this.app.editor.getLayout().html('');
    }

    insert(params, type) {
        const defaults = {
            target: false,
            position: false,
            html: '',
            clean: false,
            parse: true,
            current: false,
            instance: false,
            caret: false,
            remove: true,
            type: false,
            paragraphize: true
        };

        this.params = { ...defaults, ...params };

        if (this.params.html) {
            this.params.html = this.app.broadcastHtml('editor.before.insert', this.params.html);
        }

        this.app.container.setFocus();

        let inserted;
        if (type === 'set' || this.app.editor.isSelectAll()) {
            const setter = new InsertionSetter(this.app, this.params);
            inserted = setter.setContent();
        } else {
            if (this.params.instance) {
                const inserter = new InstanceInserter(this.app, this, this.params);
                inserted = inserter.insert();
            } else {
                const inserter = new HtmlInserter(this.app, this, this.params);
                inserted = this.params.html.trim() === '<br>' ? this.insertBreakline() : inserter.insert();
            }
        }

        if (inserted) {
            this.app.broadcast('editor.insert', { inserted });
        }

        setTimeout(() => this.app.observer.observe(), 0);

        return inserted;
    }

    insertNode(node, caret, splitinline) {
        if (splitinline) {
            const selection = new TextRange(this.app);
            const inlines = selection.getNodes({ type: 'inline' });
            if (inlines.length !== 0) {
                return this._splitInline(inlines, node);
            }
        }

        return this._insertFragment({ node: this.dom(node).get() }, caret);
    }

    insertHtml(html, caret) {
        return this._insertFragment({ html }, caret);
    }

    insertText(text, point, force = false) {
        const selection = new TextRange(this.app);
        const caret = new Caret(this.app);
        const utils = new Utils(this.app);
        const instance = this.app.block.get();

        if (!instance || !instance.isEditable()) {
            return this.insert({ html: text, caret: point });
        }

        if (selection.is()) {
            const cleanText = force ? text : utils.getTextFromHtml(text, { nl: true });
            const range = selection.getRange();

            const marker = this._findSelectionMarker(range);
            if (marker) {
                const textNode = document.createTextNode(cleanText);
                marker.replaceWith(textNode);

                caret.set(textNode, point || 'end');
                this.app.context.close();

                return textNode;
            }

            const textNode = document.createTextNode(cleanText);
            range.deleteContents();
            range.insertNode(textNode);

            caret.set(textNode, point || 'end');
            this.app.context.close();

            return textNode;
        }
    }

    insertNewline(caret = 'after', doublenode = false) {
        const text = doublenode ? '\n\n' : '\n';
        const node = document.createTextNode(text);
        return this._insertFragment({ node }, caret);
    }

    insertBreakline(caret = 'after', split = true) {
        const selection = new TextRange(this.app);
        const inlines = selection.getNodes({ type: 'inline' });

        if (split && selection.isCollapsed() && inlines.length) {
            return this._splitInline(inlines, document.createElement('br'));
        } else {
            return this._insertFragment({ node: document.createElement('br') }, caret);
        }
    }

    insertPoint(e) {
        const utils = new Utils(this.app);
        const caret = new Caret(this.app);
        const selection = new TextRange(this.app);

        const marker = utils.createInvisibleChar();
        const { clientX: x, clientY: y } = e;
        const doc = this.app.page.getDocNode();
        let range;

        if (doc.caretPositionFromPoint) {
            const pos = doc.caretPositionFromPoint(x, y);
            range = selection.getRange() || doc.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.collapse(true);
            range.insertNode(marker);
        } else if (doc.caretRangeFromPoint) {
            range = doc.caretRangeFromPoint(x, y);
            range.insertNode(marker);
        }

        caret.set(marker, 'after');
    }

    detectPosition($target, position) {
        if (position) return position;

        const caret = new Caret(this.app);

        if ($target.text().trim() === '') {
            return 'after';
        } else if (caret.is($target, 'end')) {
            return 'after';
        } else if (caret.is($target, 'start')) {
            return 'before';
        } else {
            return 'split';
        }
    }

    // Private methods

    _findSelectionMarker(range) {
        const container = range.startContainer;
        const el = (container.nodeType === Node.ELEMENT_NODE) ? container : container.parentElement;

        if (!el) return null;

        if (
            el.tagName === 'SPAN' &&
            el.classList.contains('rx-selection-marker') &&
            /^rx-selection-marker-/.test(el.id)
        ) {
            return el;
        }

        return null;
    }

    _splitInline(inlines, node) {
        const splitter = new ElementSplitter(this.app);
        const caret = new Caret(this.app);
        const $part = splitter.split(inlines[0]);

        $part.before(node);
        if ($part.html() === '') {
            caret.set($part, 'after');
            $part.remove();
        }
        else {
            caret.set($part, 'start');
        }

        return this.dom(node);
    }

    _insertFragment({ html, fragment, node }, point) {
        const frag = new Fragment(this.app);
        const caret = new Caret(this.app);
        const createdFragment = html || fragment ? frag.create(html || fragment) : null;

        if (createdFragment) {
            frag.insert(createdFragment);
        } else if (node) {
            frag.insert(node);
        }

        if (point) {
            const target = node || (point === 'start' ? createdFragment?.first : createdFragment?.last);
            if (target) caret.set(target, point);
        }

        const nodes = node || createdFragment?.nodes;
        if (Array.isArray(nodes)) {
            nodes.forEach(node => {
                const $node = this.dom(node);
                if (!$node.dataget('instance')) {
                    const type = $node.attr('data-rx-type');
                    if (type) {
                        this.app.create(`block.${type}`, $node);
                    }
                }
            });
        }

        this.app.context.close();
        return this.dom(nodes);
    }

    _cleanUpPart($part) {
        $part.find('.rx-block-focus').removeClass('rx-block-focus rx-block-control-focus');
        $part.removeClass('rx-block-focus rx-block-control-focus');
    }
}

Redactor.Insertion = Insertion;
class InsertionSetter {
    constructor(app, params) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;
        this.utils = new Utils(app);
        this.params = params;
    }

    setContent() {
        let { html, caret } = this.params;

        const sanitizer = new Sanitizer(this.app);
        html = sanitizer.sanitize(html);

        const isEmpty = this.utils.isEmptyHtml(html);
        const isLine = this.utils.isLine(html);

        this.params.html = (isLine) ? this.app.block.createHtml(html) : html

        const cleanedHtml = this._cleanHtml(this.params.html);
        const nodes = this._parseHtml(cleanedHtml);
        const $inserted = this.dom(nodes);
        const $firstNode = this.dom(nodes).first();
        const $lastNode = this.dom(nodes).last();

        this._setEditorContent(nodes);

        if (caret) {
            const $targetNode = caret === 'start' ? $firstNode : $lastNode;
            setTimeout(() => {
                this.app.block.set($targetNode, caret);
            }, 0);
        }

        if (isEmpty) {
            this.app.broadcast('editor.empty');
        }

        this.app.editor.build();
        this.app.broadcast('editor.set', { inserted: $inserted });

        return $inserted;
    }

    _cleanHtml(html) {
        const cleaner = new Cleaner(this.app);
        const encoder = new CleanerEncoder(this.app);
        return this.params.clean ? cleaner.clean(html) : html;
    }

    _parseHtml(html) {
        const parser = new Parser(this.app);
        return this.params.parse
                ? parser.parse(html, { type: this._getParseType(), nodes: true, paragraphize: this.params.paragraphize })
                : parser.build(html).get().childNodes;
    }

    _getParseType() {
        return this.utils.isLine(this.params.html) ? 'line' : 'html';
    }

    _setEditorContent(nodes) {
        const $layout = this.app.editor.getLayout();

        this.app.editor.unsetSelectAll();
        $layout.html('');
        $layout.append(nodes);
    }
}
class HtmlInserter {
    constructor(app, insertion, params) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;
        this.p = params;
        this.utils = new Utils(this.app);
        this.insertion = insertion;
    }

    insert() {
        const current = this.p.current || this.app.block.get();
        if (current && current.isNondeletable()) {
            this.app.block.set(current);
            return;
        }

        if (typeof this.p.html !== 'string') {
            this.p.html = this.dom(this.p.html).outer();
        }

        this.p.html = this._isOnlyListItems(this.p.html) ? `<ul>${this.p.html}</ul>` : this.p.html;

        this.isEmpty = this.utils.isEmptyHtml(this.p.html);
        this.isLine = this.utils.isLine(this.p.html, this.p.type);

        if (this.isLine && this.config.is('paste.paragraphizeLines')) {
            this.isLine = false;
            const paragraphizer = new Paragraphizer(this.app);
            this.p.html = paragraphizer.parse(this.p.html);
        }

        if (this.isEmpty) return;

        if (this.p.target) {
            this._createEmptyBlock();
            return this._insertToTarget();
        } else if (this.app.blocks.is()) {
            this._createEmptyBlock();
            this.app.context.close();
            return this._insertToBlocks();
        } else if (!current) {
            this._createEmptyBlock();
            return this._insertToEditor();
        } else if (this._isTableToTable(current, this.p.html)) {
            return;
        } else if (this._isListToList(current, this.p.html)) {
            return this._insertToList(current);
        } else if (current && (current.isEditable() || current.isType('quote') || current.isInline())) {
            if (this.isEmpty) return;
            return this._insertToOneEditable(current);
        } else if (current && !current.isEditable()) {
            this._createEmptyBlock();
            return this._insertToOneNotEditable(current);
        }

        return null;
    }

    _insertToTarget() {
        const position = this.p.position || 'after';
        const $block = this.dom(this.p.target);
        this.p.html = this._clean(this.p.html);

        const nodes = this._parse(this.p.html);
        const $inserted = this.dom(nodes);
        const $lastNode = this._getLastNode(nodes);

        $block[position](nodes);

        if (this.p.remove) {
            $block.fadeOut(500, () => {
                $block.remove();
                this.app.block.set($lastNode, 'end', false, true);
            });
        } else {
            this.app.block.set($lastNode, 'end', false, true);
        }

        this.app.editor.build();
        return $inserted;
    }

    _insertToBlocks() {
        const selection = new TextRange(this.app);
        this.p.html = this._clean(this.p.html);

        const nodes = this._parse(this.p.html);
        const $inserted = this.dom(nodes);
        const $lastNode = this._getLastNode(nodes);

        if (this.isLine) {
            this.insertion._insertFragment({ fragment: nodes });
        } else {
            selection.truncate();
            this.app.context.close();

            const last = this.app.blocks.get({ last: true, selected: true, instances: true });
            const $block = last.getBlock();

            if (last.isType('listitem') && this._isListToList(last, this.p.html)) {
                $block.before(this.dom(nodes).children());
            } else {
                $block.before(nodes);
            }
        }

        this.app.editor.build();
        this.app.block.set($lastNode, 'end');

        return $inserted;
    }

    _insertToEditor() {
        let position = this.config.get('addPosition') === 'top' ? 'before' : 'after';
        let current = this.config.get('addPosition') === 'top'
            ? this.app.blocks.get({ first: true, instances: true })
            : this.app.blocks.get({ last: true, instances: true });

        this.p.html = this._clean(this.p.html);
        const nodes = this._parse(this.p.html);
        const $inserted = this.dom(nodes);
        const $lastNode = this._getLastNode(nodes);

        if (this.config.get('addPosition') === 'top') {
            current = this.app.blocks.get({ first: true, instances: true });
            position = 'before';
        }
        else {
            current = this.app.blocks.get({ last: true, instances: true });
            position = 'after';
        }

        current.getBlock()[position](nodes);
        this.app.scroll.scrollTo($lastNode);
        this.app.editor.build();
        this.app.block.set($lastNode, 'end');

        return $inserted;
    }

    _insertToList(current) {
        const selection = new TextRange(this.app);
        const $block = current.getBlock();

        this.p.html = this._clean(this.p.html);
        const nodes = this._parse(this.p.html);
        const $nodes = this.dom(nodes);
        const $lastNode = this._getLastNode(nodes);

        if (current.isType('list')) {
            $block.append($nodes.children());
        } else {
            const position = this.insertion.detectPosition($block);
            selection.truncate();
            this.app.context.close();

            if (position === 'split') {
                this.insertion._insertFragment({ fragment: nodes });
            } else {
                $block[position]($nodes.children());
            }
        }

        this.app.editor.build();
        this.app.block.set($lastNode, 'end');
        return $nodes.children();
    }

    _insertToOneEditable(current) {
        const caret = new Caret(this.app);
        const selection = new TextRange(this.app);

        this.p.html = this._clean(this.p.html);
        this.p.html = this._cleanSpecial(this.p.html, current);
        const nodes = this._parse(this.p.html);

        let $inserted = this.dom(nodes);
        const $lastNode = this._getLastNode(nodes);
        const $block = current.getBlock();

        if (current.isInline() && !current.isEditable()) {
            caret.set(current.getBlock(), 'after');
            current.remove();
        }

        if (this.isLine) {
            $inserted = this._insertLineNodes(current, nodes);
        } else {
            $inserted = this._insertBlockNodes(current, $block, nodes, selection);
        }

        this.app.editor.build();

        if (this.isLine) {
            caret.set($lastNode, 'end');
        } else {
            this.app.block.set($lastNode, 'end');
        }

        return $inserted;
    }

    _insertLineNodes(current, nodes) {
        const caretPos = this.p.caret || 'end';

        if (current.isType('todoitem')) {
            const $tmpnodes = this.dom('<div>').append(nodes);
            return this.dom(this._insertFragment._insertFragment({ html: $tmpnodes.text() }, caretPos));
        }

        let $li = this.dom(nodes).find('li');
        if (current.isType('listitem') && $li.length) {
            const html = $li.html();
            return this.dom(this.insertion._insertFragment({ html }, caretPos));
        }

        return this.dom(this.insertion._insertFragment({ fragment: nodes }, caretPos));
    }

    _insertBlockNodes(current, $block, nodes, selection) {
        const $inserted = this.dom(nodes);
        let position = this.p.position;
        let remove = false;

        if (this.utils.isEmptyHtml($block.html()) || selection.isAll(current.getBlock())) {
            remove = this.p.type !== 'input';
            position = 'after';
        } else {
            position = position || this.insertion.detectPosition($block, position);
        }

        if (!remove) {
            selection.truncate();
            this.app.context.close();
        }

        if (position === 'split') {
            const splitter = new ElementSplitter(this.app);
            const $part = splitter.split($block);
            $part.before(nodes);
            this.insertion._cleanUpPart($part);
        } else {
            $block[position](nodes);
        }

        if (remove) {
            current.remove();
        }

        return $inserted;
    }

    _insertToOneNotEditable(current) {
        this.p.html = this._clean(this.p.html);
        const nodes = this._parse(this.p.html);
        const $inserted = this.dom(nodes);
        const $lastNode = this._getLastNode(nodes);

        let $block = current.getBlock();
        if (current.isType(['cell', 'row', 'column'])) {
            $block.html(nodes);
        } else {
            $block.after(nodes);
        }

        this.app.editor.build();
        this.app.block.set($lastNode, 'end');

        return $inserted;
    }

    _createEmptyBlock() {
        if (this.isLine) {
            this.p.html = this.app.block.createHtml(this.p.html);
        }
    }

    _clean(html) {
        const cleaner = new Cleaner(this.app);
        html = this.p.clean ? cleaner.clean(html) : html;

        return html;
    }

    _cleanSpecial(html, current) {
        const remover = new CleanerRemover(this.app);
        const modifier = new CleanerModifier(this.app);

        const type = current.getType();
        let clean = ['address', 'figcaption', 'quote', 'todoitem', 'dlist'].includes(type);
        let except = false;

        if (type === 'list' || type === 'listitem') {
            clean = true;
            except = ['ul', 'ol', 'li'];
        } else if (type === 'pre') {
            clean = true;
        }

        if (type === 'heading') {
            html = html.replace(/<b[^>]*>/gi, '');
            html = html.replace(/<\/b>/gi, '');
        }

        if (clean) {
            this.isLine = true;

            if (type === 'pre') {
                html = remover.removeBreakline(html);
            } else if (type !== 'list' && type !== 'listitem') {
                html = modifier.addBrToBlocks(html);
            }

            html = remover.removeBlockTags(html, false, except);
            html = html.replace(/<br\s?\/?>\n?$/gi, '');
        }

        return html;
    }

    _parse(html) {
        const parser = new Parser(this.app);
        return this.p.parse
            ? parser.parse(html, { type: this.isLine ? 'line' : 'html', nodes: true, paragraphize: this.p.paragraphize })
            : parser.build(html).get().childNodes;
    }

    _isListToList(instance, html) {
        let $list = this.dom('<div>').html(html);
        $list.find('meta').remove();

        // unwrap b fixes google docs
        $list.find('b').unwrap();
        $list = $list.children().first();
        if ($list.length === 0) return false;

        return (instance.isType(['list', 'listitem']) && ['ul', 'ol'].includes($list.tag()));
    }

    _isTableToTable(instance, html) {
        return instance.getClosest('table') && this.dom('<div>').html(html).find('table').length !== 0;
    }

    _getFirstNode(nodes) {
        return this.dom(nodes).first();
    }

    _getLastNode(nodes) {
        return this.dom(nodes).last();
    }

    _isOnlyListItems(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<ul>${html}</ul>`, 'text/html');
        const children = Array.from(doc.querySelector('ul').children);

        return children.length > 0 && children.every(node => node.tagName === 'LI');
    }
}
class InstanceInserter {
    constructor(app, insertion, params) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;
        this.p = params;
        this.caret = new Caret(this.app);
        this.splitter = new ElementSplitter(this.app);
        this.insertion = insertion;
    }

    insert() {
        const current = this.p.current || this.app.block.get();
        if (current && current.isNondeletable()) {
            this.app.block.set(current);
            return;
        }

        this.p.caret = this.p.instance.isType(['table', 'quote', 'layout']) ? 'start' : this.p.caret || 'end';

        if (!current) {
            return this._insertNotSelected();
        }

        if (current.isEditable()) {
            this.p.position = this.insertion.detectPosition(current.getBlock(), this.p.position);
        }

        if (this._isTableToTable(current)) {
            return;
        }

        return this._insertInstance(current);
    }

    _insertNotSelected() {
        const position = this.config.get('addPosition') === 'top' ? 'before' : 'after';
        const current = this.app.blocks.get({ [position === 'before' ? 'first' : 'last']: true, instances: true });
        const $current = current.getBlock();
        const $block = this.p.instance.getBlock();
        let $wrapper;

        if (this.p.instance.isInline()) {
            $wrapper = this.app.block.create().getBlock();
            $wrapper.append($block);
        } else if (this.p.instance.isType('list') && current.isType('list')) {
            const $items = this.p.instance.getItems();
            current.getBlock().append($items);
        }

        $current[position]($wrapper || $block);
        this._rebuildAndSetCaret($block);

        return this.p.instance;
    }

    _insertInstance(current) {
        const $block = this.p.instance.getBlock();
        let $current = current.getBlock();
        let position = this.p.position;
        let remove = false;
        let action = false;

        if (this.p.type === 'duplicate') {
            $current.after($block);
            return this._finalizeInsert($block);
        }

        if (this._isListInsert(current)) {
            return this._insertList(current);
        }

        if (this.p.instance.isInline()) {
            ({ position, $current, remove } = this._handleInlineInsert(current, $current, position));
        } else if (current.isInline()) {
            position = 'split';
            this.caret.set($current, 'after');
            $current = $current.parent().closest('[data-rx-type]');
            remove = true;
        } else {
            ({ position, $current, action } = this._handleBlockInsert(current, $current, position));
        }

        if (position === 'split') {
            this._splitAndInsert($current, $block, action);
        } else if (position === 'fragment') {
            const sel = new TextRange(this.app);
            const controlledBLock = sel.getBlockControlled();
            if (controlledBLock) {
                const controlledInstance = this.dom(controlledBLock).dataget('instance');
                if (controlledInstance && controlledInstance.isInline()) {
                    const caret = new Caret(this.app);
                    caret.set(controlledBLock, 'after');
                }
            }

            this.insertion._insertFragment({ node: $block.get() }, 'start');
        } else {
            $current[position || 'after']($block);
        }

        if (remove) current.remove();
        if (this.p.remove && current.isEditable() && current.isEmpty()) current.remove();

        return this._finalizeInsert($block);
    }

    _isTableToTable(current) {
        return this.p.instance.isType('table') && (current.isType('table') || current.getClosest('table'));
    }

    _isListInsert(current) {
        return this.p.instance.isType('list') && current.isType('listitem');
    }

    _insertList(current) {
        const $items = this.p.instance.getItems();
        if ($items.length === 1 && $items[0] === '') {
            const $block = this.p.instance.getBlock();
            current.getBlock().append($block);
        } else {
            const $part = this.splitter.split(current.getBlock());
            $part.prepend($items);
        }

        return this.p.instance;
    }

    _handleInlineInsert(current, $current, position) {
        let remove = false;
        let $wrapper;

        if (current.isInline()) {
            position = 'after';
        } else if (current.isEditable()) {
            position = 'fragment';
        } else {
            position = 'after';
            $wrapper = this.app.block.create().getBlock();
            $wrapper.append(this.p.instance.getBlock());
        }

        return { position, $current: $wrapper || $current, remove };
    }

    _handleBlockInsert(current, $current, position) {
        let action = false;

        if (current.isType(['cell', 'column'])) {
            position = this.p.position || 'prepend';
        } else if (current.isType(['row', 'figcaption'])) {
            position = position === 'split' ? 'after' : position;
            $current = current.getParent().getBlock();
        } else if (current.isType('todo')) {
            position = this._handleTodoInsert(current);
        } else if (current.isType('quote')) {
            position = this._handleQuoteInsert(current);
        } else if (current.isType('listitem')) {
            ({ position, action } = this._handleListItemInsert(current));
            $current = current.getBlock().parents('ul, ol').last();
        } else if (current.isType('list') && position === 'split') {
            action = 'list-empty';
        }

        return { position, $current, action };
    }

    _handleTodoInsert(current) {
        if (this.p.instance.isType('todoitem')) {
            return 'append';
        }
        if (this.p.instance.isType('todo')) {
            this.p.instance.getBlock().contents();
            return 'append';
        }
        return 'after';
    }

    _handleQuoteInsert(current) {
        if (current.isCaretStart()) {
            return 'before';
        }
        if (current.isCaretEnd()) {
            return 'after';
        }
        return 'split';
    }

    _handleListItemInsert(current) {
        let position = 'split';
        let action = 'list-normalize';

        if (current.getParentTopInstance().isCaretStart()) {
            position = 'before';
        } else if (current.getParentTopInstance().isCaretEnd()) {
            position = 'after';
        }

        return { position, action };
    }

    _splitAndInsert($current, $block, action) {
        const $part = this.splitter.split($current);
        $part.before($block);

        if (action === 'list-empty') {
            $part.find('li').first().remove();
        } else if (action === 'list-normalize') {
            this._normalizeList($part);
        }

        this.insertion._cleanUpPart($part);
    }

    _normalizeList($part) {
        const $li = $part.find('li').first();
        const $liClone = $li.clone();
        $liClone.find('ol, ul').remove();

        if (!$liClone.text().trim()) {
            const $ul = $li.find('ol, ul').first().children();
            $ul.find('ul, ol').each(($node) => {
                $node.removeAttr('data-rx-type');
                this.app.create('block.list', $node);
            });

            $part.find('li').each(($node) => {
                $node.removeAttr('data-rx-type');
                this.app.create('block.listitem', $node);
            });

            $li.before($ul);
            $li.remove();
        }
    }

    _finalizeInsert($block) {
        this._rebuildAndSetCaret($block);
        return this.p.instance;
    }

    _rebuildAndSetCaret($block) {
        this.app.editor.build();
        if (this.p.caret) {
            setTimeout(() => {
                this.app.block.set($block, this.p.caret);
                this.app.scroll.scrollTo($block);
            }, 0);
        }
    }
}
class TextRange {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
        this.page = app.page;
        this.editor = app.editor;

        // get selection
        this.sel = this._getSelection();
        this.range = new RangeManagement(this.app, this);
        this.elements = new RangeElements(this.app, this);
    }

    // range

    getRange() {
        return this.range.get(this.sel);
    }

    setRange(range) {
        this.range.update(range);
    }

    updateRange(range, sel) {
        this.range.update(range, sel)
    }

    isCollapsed() {
        return this.range.isCollapsed();
    }

    isBackwards() {
        return this.range.isBackwards();
    }

    isCursorInFirstOrLastLine() {
        return this.range.isCursorInFirstOrLastLine();
    }

    truncate() {
        this.range.truncate();
    }

    // elements

    getCurrent() {
        return this.elements.current();
    }

    getParent() {
        return this.elements.parent();
    }

    getClosest(selector) {
        return this.elements.closest(selector);
    }

    getElement(el) {
        return this.elements.element(el);
    }

    getInline(el) {
        return this.elements.inline(el);
    }

    getInlineTop(el, tag) {
        return this.elements.inlineTop(el, tag);
    }

    getBlock(el) {
        return this.elements.block(el);
    }

    getBlockControlled(el) {
        return this.elements.controlled(el);
    }

    getNodes(params) {
        return this.elements.nodes(params);
    }

    // selection
    set(sel) {
        this.sel = sel;
    }

    get() {
        return this._getSelection();
    }

    getPosition(type) {
        const pos = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
        const range = this.getRange();
        return range ? this._getRangePosition(range, type) : pos;
    }

    getText(position, len, el) {
        if (!this.sel) return '';
        let range = this.getRange();
        return range ? this._getRangeText(range, position, len, el) : this.sel.toString();
    }

    getHtml() {
        if (!this.sel) return '';
        let range = this.getRange();
        return range ? this._getRangeHtml(range) : '';
    }

    getCursorContext(position = "after") {
        if (!this.sel) return false;

        const range = this.getRange();
        let node = range.startContainer;
        let offset = range.startOffset;

        if (node.nodeType === Node.TEXT_NODE) {
            const textLength = node.textContent.length;

            if (position === "before" && offset === 0) {
                return node.previousSibling;
            }
            if (position === "after" && offset === textLength - 1) {
                return node.nextSibling;
            }
        }

        return false;
    }

    contains(el) {
        const current = this.getCurrent();
        return current ? this._node(el).contains(current) : false;
    }

    is(el) {
        if (typeof el === 'undefined') {
            return !!this.sel;
        }

        const nodes = this.getNodes();
        return nodes.includes(this._node(el));
    }

    isAll(el) {
        if (this.isCollapsed()) return false;

        const node = el ? this._node(el) : this.editor.getLayout().get();
        const isEditor = !el;
        const isNode = isEditor || this.is(node);
        const range = this.getRange();

        return isNode && node.textContent && node.textContent.trim().length === range.toString().trim().length;
    }

    select(el) {
        const node = el ? this._node(el) : this.editor.getLayout().get();
        if (!node) return;

        const range = this.page.getDocNode().createRange();
        range.selectNodeContents(node);
        this.setRange(range);
    }

    remove() {
        if (this.sel) {
            this.sel.removeAllRanges();
            this.sel = false;
        }
    }

    collapse(type = 'start') {
        if (this.sel && !this.isCollapsed()) {
            if (type === 'start') {
                this.sel.collapseToStart();
            } else {
                this.sel.collapseToEnd();
            }
        }
    }

    // @deprecated 5.0
    isFullySelected(el) {
        return this.isAll(el);
    }

    // @deprecated 5.0
    update() {
        return this.sel;
    }

    // Private methods

    _getSelection() {
        const selection = this?.page?.getWinNode()?.getSelection() ?? false;
        return (selection.rangeCount > 0 && this.dom(selection.anchorNode).closest('.rx-editor').length > 0)
            ? selection
            : false;
    }

    _node(el) {
        return this.dom(el).get();
    }

    _getRangePosition(range, type) {
        let rect = {};
        if (range.startContainer === range.endContainer && this.isAll(range.startContainer)) {
            rect = range.getBoundingClientRect();
        } else {
            range = range.cloneRange();
            if (type === 'end') {
                if (range.endOffset !== 0) {
                    range.setStart(range.endContainer, range.endOffset);
                } else if (range.endContainer.previousElementSibling) {
                    range.setStart(range.endContainer.previousElementSibling.firstChild, 1);
                }
            } else {
                const offset = range.startOffset - 1;
                range.setStart(range.startContainer, offset < 0 ? 0 : offset);
            }
            rect = range.getBoundingClientRect();
        }

        return {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            width: rect.right - rect.left,
            height: rect.bottom - rect.top
        };
    }

    _getRangeText(range, position, len, el) {
        const cloned = range.cloneRange();
        el = el ? this._node(el) : this.editor.getLayout().get();
        len = typeof len === 'undefined' ? 1 : len;

        if (position === 'before') {
            cloned.collapse(true);
            cloned.setStart(el, 0);
            return (len === true) ? cloned.toString() : cloned.toString().slice(-len);
        } else if (position === 'after') {
            cloned.selectNodeContents(el);
            cloned.setStart(range.endContainer, range.endOffset);
            return (len === true) ? cloned.toString() : cloned.toString().slice(0, len);
        }

        return cloned.toString();
    }

    _getRangeHtml(range) {
        const div = document.createElement('div');
        div.appendChild(range.cloneContents());
        return div.innerHTML.replace(/<p><\/p>$/i, '');
    }
}

Redactor.TextRange = TextRange;
class RangeElements {
    constructor(app, selection) {
        this.app = app;
        this.page = app.page;
        this.editor = app.editor;
        this.dom = app.dom;
        this.selection = selection;
        this.sel = selection.sel;
    }

    current() {
        return this.sel ? this.sel.anchorNode : false;
    }

    parent() {
        const current = this.current();
        return current ? current.parentNode : false;
    }

    closest(selector) {
        const current = this.current();
        const $el = this.dom(current).closest(selector);
        return $el.length !== 0 ? $el.get() : false;
    }

    element(el) {
        return this._findElement(el, 'element');
    }

    inline(el) {
        return this._findElement(el, 'inline');
    }

    inlineTop(el, tag) {
        const node = el ? this._node(el) : this.current();
        return this._findInlineParent(node, tag);
    }

    block(el) {
        return this._findElement(el, 'block');
    }

    controlled(el) {
        let node = el ? this._node(el) : this.current();
        while (node) {
            if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute('data-rx-type')) {
                return node;
            }
            node = node.parentNode;
        }
        return false;
    }

    nodes(data) {
        if (!this.sel) return [];
        const range = this.selection.getRange();
        let nodes = this.editor.isSelectAll()
            ? [...this.editor.getLayout().get().getElementsByTagName("*")]
            : this._collectNodes(range, data?.partial);

        nodes = [...new Set(nodes)]; // Remove duplicates always
        return nodes.length ? this._filter(nodes, range, data) : nodes;
    }

    // Private methods

    _node(el) {
        return this.dom(el).get();
    }

    _findElement(el, type) {
        if (!this.sel) return false;
        let node = el || this.current();
        node = this._node(node);
        const inspector = new ElementInspector(this.app);

        while (node) {
            if (inspector.is(node, type)) {
                return node;
            }
            node = node.parentNode;
        }
        return false;
    }

    _findInlineParent(node, tag) {
        let highestInlineParent = null;
        const inspector = new ElementInspector(this.app);
        while (node) {
            if (node.nodeType === Node.ELEMENT_NODE && inspector.is(node, 'inline')) {
                highestInlineParent = node;
                if (node.tagName.toLowerCase() === tag) break;
            }
            node = node.parentNode;
        }
        return highestInlineParent;
    }

    _collectNodes(range, partial) {
        const nodes = [];
        const start = range.startContainer.childNodes[range.startOffset] || range.startContainer;
        const end = range.endContainer.childNodes[range.endOffset] || range.endContainer;
        const commonAncestor = range.commonAncestorContainer;

        const isTextNode = node => node.nodeType === 3;
        const isInsideCommonAncestor = node => commonAncestor.contains(node.parentNode);

        const addNode = (node) => {
            // If it is a table row (TR), then add the parent table if it is not already in nodes
            if (node.tagName === 'TR') {
                const table = this.dom(node).closest('table').get();
                if (!nodes.includes(table)) {
                    nodes.push(table);
                }
            } else {
                nodes.push(node);
            }
        }

        if (!this.editor.isEditor(start)) {
            nodes.push(start);
        }

        let node;
        if (partial) {
            if (isTextNode(start)) {
                nodes.unshift(this.selection.getBlock(start));
            }

            for (node = start; node; node = this._nextNode(node)) {
                if (node === commonAncestor) break;
                if (!isTextNode(node) && !isInsideCommonAncestor(node)) break;

                addNode(node);
                if (node === end) break;
            }
        } else {
            for (node = start.parentNode; node; node = node.parentNode) {
                if (this.editor.isEditor(node)) break;
                nodes.push(node);
                if (node === commonAncestor) break;
            }

            nodes.reverse();
            for (node = start; node; node = this._nextNode(node)) {
                if (!isTextNode(node) && node.tagName === 'TR') {
                    const table = this.dom(node).closest('table').get();
                    if (!nodes.includes(table)) {
                        nodes.push(table);
                    }
                }
                if (!isTextNode(node) && !isInsideCommonAncestor(node)) break;

                addNode(node);
                if (node === end) break;
            }
        }

        return nodes;
    }

    _nextNode(node) {
        if (node.firstChild) return node.firstChild;
        while (node) {
            if (node.nextSibling) return node.nextSibling;
            node = node.parentNode;
        }
    }

    _filter(nodes, range, data) {
        const resultNodes = new Set();
        const selectedText = this._sanitizeText(this.selection.getText());
        const inspector = new ElementInspector(this.app);

        nodes.forEach(node => {
            if (this.editor.isEditor(node)) {
                return;
            }
            let push = true;
            if (data) {
                push = data.types ? this._filterByTypes(push, data, node, inspector) : push;
                push = data.selected ? this._filterBySelected(push, data, node, range, selectedText) : push;
                push = data.tags ? this._filterByTags(push, data, node) : push;
                push = data.type ? this._filterByType(push, data, node, inspector) : push;

                if (data.type === 'inline' && inspector.is(node, 'inline')) {
                    if (node.parentNode && inspector.is(node.parentNode, 'inline')) {
                        resultNodes.add(node.parentNode);
                    }
                }
            }

            if (push) {
                resultNodes.add(node);
            }
        });

        return Array.from(resultNodes);
    }

    _filterByTags(push, data, node) {
        const isTagName = (typeof node.tagName !== 'undefined');
        if (!isTagName || (isTagName && data.tags.indexOf(node.tagName.toLowerCase()) === -1)) {
            push = false;
        }
        return push;
    }

    _filterBySelected(push, data, node, range, selected) {
        if (data.selected === true && !this._isTextInRange(range, node)) {
            push = false;
        } else if (data.selected === 'inside') {

            if (node.nodeType === 1 && node.tagName === 'A') {
                push = true;
            } else {
                push = this._textMatches(node, selected);
            }
        }
        return push;
    }

    _filterByType(push, data, node, inspector) {
        let type = data.inline === false ? 'block-data-not-inline' : data.type;

         if (data.type === 'inline') {
            if (data.link) {
                if (!inspector.is(node, data.type)) {
                    push = false;
                }
            } else {
                if ((node.nodeType === 1 && node.tagName === 'A') || !inspector.is(node, data.type)) {
                    push = false;
                }
            }
            if (data.buttons && inspector.is(node, data.type, false)) {
                push = true;
            }
        }
        else if (!inspector.is(node, type)) {
            push = false;
        }

        return push;
    }

    _filterByTypes(push, data, node, inspector) {
        let type = inspector.getType(node);
        if (data.types.indexOf(type) === -1) {
            push = false;
        }

        return push;
    }

    _sanitizeText(text) {
        return text ? text.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&") : '';
    }

    _textMatches(node, selectedText) {
        const utils = new Utils(this.app);
        const text = node.nodeType !== 9 ? utils.removeInvisibleChars(node.textContent) : '';
        return selectedText === text || text.includes(selectedText);
    }

    _isTextInRange(range, node) {
        const treeWalker = this.page.getDocNode().createTreeWalker(node, NodeFilter.SHOW_TEXT, node => NodeFilter.FILTER_ACCEPT, false);
        let first, last, textNode;
        while ((textNode = treeWalker.nextNode())) {
            if (!first) first = textNode;
            last = textNode;
        }

        const nodeRange = range.cloneRange();
        if (first) {
            nodeRange.setStart(first, 0);
            nodeRange.setEnd(last, last.length);
        } else {
            nodeRange.selectNodeContents(node);
        }
        return range.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0 && range.compareBoundaryPoints(Range.END_TO_END, nodeRange) >= 0;
    }
}
class RangeManagement {
    constructor(app, selection) {
        this.app = app;
        this.page = app.page;
        this.selection = selection;
    }

    get(sel = this.selection.sel) {
        return sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : false;
    }

    set(range) {
        const sel = this.page.getWinNode().getSelection();
        this.update(range, sel);
    }

    update(range, sel) {
        if (!sel) {
            sel = this.selection.sel || this.page.getWinNode().getSelection();
        }

        sel.removeAllRanges();
        sel.addRange(range);
    }

    truncate() {
        const range = this.get();
        if (range && !this.isCollapsed()) {
            range.deleteContents();
        }
    }

    isCollapsed() {
        let range = this.get();
        return !this.selection.sel || !range || this.selection.sel.isCollapsed || (range.toString().length === 0);
    }

    isBackwards() {
        return (this.selection.sel && !this.selection.sel.isCollapsed) ? this._isSelectionBackwards(this.selection.sel) : false;
    }

    isCursorInFirstOrLastLine() {
        const sel = this.page.getWinNode().getSelection();
        if (!sel.rangeCount) return { isFirstLine: false, isLastLine: false };

        const range = sel.getRangeAt(0);
        const doc = this.page.getDocNode();

        // Check rects before cursor
        const rBefore = doc.createRange();
        rBefore.setStart(range.startContainer, 0);
        rBefore.setEnd(range.startContainer, range.startOffset);
        const rectsBefore = rBefore.getClientRects();
        if (!rectsBefore.length) return { isFirstLine: false, isLastLine: false };

        // Check rects after cursor
        const rAfter = doc.createRange();
        rAfter.setStart(range.endContainer, range.endOffset);
        rAfter.setEnd(range.endContainer, range.endContainer.length || range.endContainer.childNodes.length);
        const rectsAfter = rAfter.getClientRects();
        if (!rectsAfter.length) return { isFirstLine: false, isLastLine: false };

        // Calculate positions
        const firstTop = rectsBefore[0].top;
        const lastBottom = rectsAfter[rectsAfter.length - 1].bottom;
        const { top: curTop, bottom: curBottom } = range.getBoundingClientRect();

        return {
            isFirstLine: curTop <= firstTop,
            isLastLine: curBottom >= lastBottom
        };
    }

    // Private methods

    _isSelectionBackwards(sel) {
        const range = this.page.getDocNode().createRange();
        range.setStart(sel.anchorNode, sel.anchorOffset);
        range.setEnd(sel.focusNode, sel.focusOffset);
        const isBackwards = range.collapsed;
        range.detach();
        return isBackwards;
    }

}
class Parser {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;
        this.block = app.block;
        this.element = app.element;

        this.defaults = {
            type: 'html', // json, line
            start: false,
            nodes: false,
            state: false,
            paragraphize: this.config.get('paragraphize')
        };

        this.parsedAttr = 'data-rx-type';

        // Initialize utilities
        this.utils = new Utils(this.app);
        this.cleaner = new Cleaner(this.app);
        this.storage = new CleanerStorage(this.app);
        this.encoder = new CleanerEncoder(this.app);
        this.transformer = new CleanerTransformer(this.app);
        this.remover = new CleanerRemover(this.app);
        this.modifier = new CleanerModifier(this.app);
        this.cache = new CleanerCache(this.app);
        this.sanitizer = new Sanitizer(this.app);
        this.inspector = new ElementInspector(this.app);
    }

    build(html) {
        return this._buildNodes(html);
    }

    parse(html, defaults = {}) {
        this.defaults = Redactor.extend(true, this.defaults, defaults);
        const parser = this._getParser(this.defaults.type);

        let content = parser.parse(html, this.defaults);

        if (this.defaults.type !== 'json') {
            content = this._buildResult(content);
        }

        return content;
    }

    clean(html, setting) {
        // Template syntax
        const templateSyntax = this.config.get('templateSyntax');
        if (templateSyntax) {
            this.config.set('clean.comments', false);
            html = this.storage.storeTemplateSyntax(html, templateSyntax);
        }

        // Handle email blocks
        if (this.app.has('email')) {
            html = this.app.email.parseBlocks(html);
        }

        // remove comments
        html = (this.config.is('clean.comments')) ? this.remover.removeComments(html) : html;

        // Store comments
        //html = this.storage.storeComments(html);

        // Fix &curren; entity in links
        html = html.replace(/¤t/gi, '&current');

        // Remove newlines in attributes
        html = this.cleaner.cleanAttributes(html);

        // Encode if necessary
        if (setting && setting.start && this.element.isTextarea()) {
            html = this.storage.storeComments(html);
            html = this.encoder.encodeCode(html);
            html = this.storage.restoreComments(html);
        }

        // Sanitize HTML
        html = this.sanitizer.sanitize(html);

        // Convert forms and frames
        html = this.transformer.convertVideo(html);
        html = this.transformer.convertForms(html);
        html = this.transformer.convertFrames(html);
        html = this.transformer.convertSvgSpan(html);

        // Store nonparse
        let nonparse = this.config.get('nonparse');
        for (let i = 0; i < nonparse.length; i++) {
            html = this.storage.store(html, nonparse[i]);
        }

        // Store elements
        html = this.storage.store(html, 'embed');
        html = this.storage.store(html, 'svg');
        html = this.storage.store(html, 'noparse');

        // Remove tags and doctype
        html = this.remover.removeTags(html, this.config.get('tags.denied'));
        html = this.remover.removeDoctype(html);

        // Remove unwanted tags and add https for links and images
        html = this.remover.removeTagsWithContent(html, ['script', 'style']);
        html = this.remover.removeEmptySpans(html);
        html = this.modifier.addHttps(html);
        html = this.remover.removeBlockTagsInside(html, ['li', 'dt', 'dd', 'address']);

        // Cache styles for block and inline tags and img
        html = this.cache.cacheStyle(html);

        // restore
        for (let i = 0; i < nonparse.length; i++) {
            html = this.storage.restore(html, nonparse[i]);
        }

        // Restore elements
        html = this.storage.restore(html, 'embed');
        html = this.storage.restore(html, 'noparse');
        html = this.storage.restore(html, 'svg');

        // Restore comments
        //html = this.storage.restoreComments(html);

        // Empty or paragraphize
        if (this.utils.isEmptyHtml(html)) {
            html = this.block.createHtml();
        } else {
            const paragraphizer = new Paragraphizer(this.app, setting.paragraphize);
            html = paragraphizer.parse(html);
        }

        // Fix div with newline
        html = html.replace(/<div>\s*<\/div>/gi, '<div></div>');

        return html;
    }

    replaceTags(html) {
        const tags = this.config.get('replaceTags');
        if (!tags) return html;

        const keys = Object.keys(tags);
        if (typeof html === 'string') {
            html = this.utils.wrap(html, ($w) => $w.find(keys.join(',')).each($node => {
                $node.replaceTag(tags[$node.tag()]);
            }));
        } else {
            html.find(keys.join(',')).each($node => {
                $node.replaceTag(tags[$node.tag()]);
            });
        }

        return html;
    }

    // Private methods

    _getParser(type) {
        switch (type) {
            case 'json':
                return new ParserJson(this.app, this);
            case 'line':
                return new ParserLine(this.app, this);
            default:
                return new ParserHtml(this.app, this);
        }
    }

    _buildResult(content) {
        if (this.defaults.nodes) {
            let $layout = this._buildNodes(content);

            // Email parsing
            if (this.app.has('email')) {
                $layout = this.app.email.parse($layout);
            }

            content = $layout.get().childNodes;
        }

        return content;
    }

    _buildNodes(html) {
        const $layout = this.dom('<div>').html(html);
        $layout.find(`[${this.parsedAttr}]`).each(this._buildNode.bind(this));
        return $layout;
    }

    _buildNode($node) {
        const type = $node.attr(this.parsedAttr);
        const block = this.app.create('block.' + type, $node);
        //const block = new Block(this.app, { type: type, source: $node });
    }
}

Redactor.Parser = Parser;
class ParserHtml {
    constructor(app, parser) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;
        this.parser = parser;
        this.parsedAttr = parser.parsedAttr;

        // Initialize utilities
        this.utils = new Utils(this.app);
        this.classApplier = new ClassApplier(this.app);
        this.inspector = new ElementInspector(this.app);
        this.paragraphizer = new Paragraphizer(this.app, this.parser.defaults.paragraphize);

        // Cache configuration values
        this.nested = this.config.get('nested');
        this.nestedValue = this.config.get('nestedValue');
        this.layoutGridClass = this.config.get('layout.grid');
        this.columnClass = this.config.get('layout.column');
    }

    parse(html, defaults) {
        this.defaults = defaults;

        html = html.trim();
        html = this.app.emitHtml('editor.before.parse', html);

        if (this.utils.isEmptyHtml(html)) {
            html = this.app.block.createHtml();
        } else {
            html = this.parser.clean(html, this.defaults);
            html = this._parseBlocks(html);
            html = this.parser.replaceTags(html);

            // Parse inside div layers (including breakline)
            html = this.paragraphizer.parseLayers(html);
            html = this._parseLayersNodes(html);
        }

        return this.app.emitHtml('editor.parse', html);
    }

    // Private methods

    _parseBlocks(html) {
        return this.utils.wrap(html, ($w) => {
            this._parseElements($w);
            this.classApplier.parse($w);
        });
    }

    _parseElements($block) {
        const nodes = this.inspector.getBlocks($block);
        for (const node of nodes) {
            this._parseNode(node);
        }
    }

    _parseNode(el) {
        const $el = this.dom(el);
        const tag = $el.tag();
        const type = this._parseType($el, tag);

        // Set type attribute
        if (type) {
            $el.attr(this.parsedAttr, type);
        }

        // Handle nested elements
        const index = this.nested.indexOf(type);
        if (index !== -1) {
            const nestedValue = this.nestedValue[index];
            if (nestedValue === true) {
                this._parseElements($el);
            } else {
                $el.find(nestedValue).each(this._parseElements.bind(this));
            }
        }
    }

    _parseType($el, tag) {
        let type;
        let dataBlock = this.config.get('dataBlock');

        if ($el.attr(this.parsedAttr)) {
            type = $el.attr(this.parsedAttr);

        // blocks
        } else if ($el.attr(dataBlock)) {
            type = $el.attr(dataBlock);
        } else {
            type = this._parseTypeByTag($el, tag);
        }

        return type;
    }

    _parseTypeByTag($el, tag) {
        let type;
        switch (tag) {
            case 'p':
                type = 'text';
                if (this._isImageBlock($el, 'p')) {
                    type = 'image';
                }
                break;
            case 'figure':
                type = 'embed';
                if (this._isImageBlock($el, 'figure')) {
                    type = 'image';
                } else if (this._hasChild($el, 'pre')) {
                    type = 'pre';
                } else if (this._hasChild($el, 'blockquote')) {
                    type = 'quote';
                }
                break;
            case 'div':
                type = 'wrapper';
                if (this._isLayoutBlock($el, 'div')) {
                    type = 'layout';
                } else if (this._isColumnBlock($el, 'div')) {
                    type = 'column';
                } else if (this._isImageBlock($el, 'div')) {
                    type = 'image';
                } else if (this._isTextBlock($el)) {
                    type = 'text';
                }
                break;
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                type = 'heading';
                break;
            case 'blockquote':
                type = 'quote';
                break;
            case 'table':
                type = 'table';
                break;
            case 'pre':
                type = 'pre';
                break;
            case 'hr':
                type = 'line';
                break;
            case 'dl':
                type = 'dlist';
                break;
            case 'address':
                type = 'address';
                break;
            case 'ul':
            case 'ol':
                type = 'list';
                if (this._isTodo($el)) {
                    type = 'todo';
                }
                break;
            default:
                type = 'wrapper';
                break;
        }

        return type;
    }

    _parseLayersNodes(html) {
        return this.utils.wrap(html, ($w) => {
            $w.find('[data-rx-tag]').each(this._parseLayersDataTag.bind(this));
            $w.find('[data-rx-type=wrapper],[data-rx-type=column]').each(($node) => {
                this._parseElements($node);
                this.classApplier.parse($node);
            });
        });
    }

    _parseLayersDataTag($node) {
        if (!$node.attr('data-rx-type')) {
            let type = 'text';
            if (this._isImageBlock($node, 'div')) {
                type = 'image';
                $node.removeAttr('data-rx-tag');
            }

            $node.attr(this.parsedAttr, type);
        }
    }

    _isLayoutBlock($el) {
        return this.layoutGridClass && $el.hasClass(this.layoutGridClass);
    }

    _isColumnBlock($el) {
        const $parent = $el.parent();
        const isParentLayout = $parent.data('rx-type') === 'layout';
        return isParentLayout || (this.columnClass && $el.hasClass(this.columnClass));
    }

    _isImageBlock($el, tag) {
        let $img = $el.find('img, picture');
        if ($img.length === 0 || (tag === 'div' && $img.closest('figure').length !== 0)) return;

        let $target = $img.first();
        let $parent = $img.first().parent();
        let $cont = $parent;
        let parentTag = ($parent.length !== 0) ? $parent.tag() : false;

        if (parentTag && ['a', 'span'].includes(parentTag)) {
            $target = $parent;
            $cont = $parent.parent();
        }

        return $cont.get(0) === $el.get(0) && !$target.prevElement().length && (tag === 'figure' || !$target.nextElement().length);
    }

    _isTextBlock($el) {
        const blocks = this.inspector.getBlocks($el);
        return blocks.length === 0 && (!this.inspector.is($el.children().first(), 'block'));
    }

    _isTodo($el) {
        if (!this.config.is('todo')) return false;

        const template = this.config.get('todo.template');
        const templateItem = this.config.get('todo.templateItem');
        const templateItemDone = this.config.get('todo.templateItemDone');

        let $first = $el.children().first();
        if ($first.length != 0) {
            let templateItemTrimmed = templateItem.replace(/\s/g, '');
            let content = $first.html();
            if (template) {
                return this._checkToTemplateMatch(template, content);

            } else {
                let item = content.startsWith(templateItem) || content.startsWith(templateItemTrimmed);
                let itemDone = content.startsWith(templateItemDone);

                if (item || itemDone) {
                    return true;
                }
            }
        }

        return false;
    }

    _checkToTemplateMatch(template, inputString) {
       const regex = new RegExp('^' + template.replace(/\$checked/g, '\\[(x| )\\]').replace(/\$content/g, '(.*)') + '$');
       return regex.test(inputString);
    }

    _hasChild($el, tag) {
        if (tag === 'pre') {
            let $pre = $el.find('pre');
            if ($pre.length !== 0) {
                return true;
            }
        }
        else if (tag === 'blockquote') {
            let $quote = $el.find('blockquote');
            let $script = $el.find('script');
            if ($script.length === 0 && $quote.length !== 0) {
                return true;
            }
        }
    }
}

Redactor.ParserHtml = ParserHtml;
class ParserJson {
    constructor(app, parser) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;
        this.parser = parser;
        this.parsedAttr = parser.parsedAttr;

        // Initialize utilities
        this.classApplier = new ClassApplier(this.app);
        this.nonparse = this.config.get('nonparse');
    }

    parse(json, defaults) {
        this.defaults = defaults;

        // Create layout and render blocks
        const $layout = this._render(this.dom('<div>'), json.blocks);

        // Apply classes
        this.classApplier.parse($layout);

        // Get result (nodes or HTML)
        let result = this.defaults.nodes ? $layout.children() : $layout.html();

        // Replace tags in result
        return this.parser.replaceTags(result);
    }

    // Private methods

    _render($layout, blocks, render = true) {
        for (const block of blocks) {
            const instance = this.app.create('block.' + block.type, block, render);
            //const instance = new Block(this.app, { type: block.type, source: block, render: render });
            const $block = instance.getBlock();

            const localRender = this._shouldRenderBlock(block, render);

            if (block.children) {
                this._render($block, block.children, localRender);
            }

            $layout.append($block);
        }

        return $layout;
    }

    _shouldRenderBlock(block, render) {
        return this.nonparse.includes(block.type) || render === false ? false : undefined;
    }
}

Redactor.ParserJson = ParserJson;
class ParserLine {
    constructor(app, parser) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;
        this.parser = parser;
        this.parsedAttr = parser.parsedAttr;

        // Initialize utilities
        this.utils = new Utils(this.app);
        this.encoder = new CleanerEncoder(this.app);
        this.remover = new CleanerRemover(this.app);
        this.modifier = new CleanerModifier(this.app);
        this.transformer = new CleanerTransformer(this.app);
        this.sanitizer = new Sanitizer(this.app);
    }

    parse(html, defaults) {
        this.defaults = defaults;

        if (html === ' ') {
            html = '&nbsp;';
        }
        else {
            html = this.app.emitHtml('editor.before.parse', html);
            html = this._parseInlineBlocks(html);
            html = this._clean(html);
            html = this.app.emitHtml('editor.parse', html);
        }

        return html;
    }

    // Private methods

    _clean(html) {

        // convert newlines to br
        //html = cleaner.store(html, 'svg');
        //html = html.replace(/\r?\n/g, "<br>");
        //html = cleaner.restore(html, 'svg');

        //html = this.encoder.encodeCode(html);
        html = this.remover.removeTags(html, this.config.get('tags.denied'));
        html = this.remover.removeTagsWithContent(html, ['script', 'style']);
        html = this.sanitizer.sanitize(html);
        html = this.remover.removeEmptySpans(html);
        html = this.modifier.addHttps(html);
        html = this.transformer.convertSvgSpan(html);
        html = this.parser.replaceTags(html);

        return html;
    }

    _parseInlineBlocks(html) {
        return this.utils.wrap(html, ($w) => {
            $w.find('[' + this.config.get('dataBlock') + ']').each(($node) => {
                if (!$node.attr('data-rx-type')) {
                    const type = $node.attr(this.config.get('dataBlock'));
                    const block = this.app.create('block.' + type, $node);
                    //const block = new Block(this.app, { type: type, source: $node });
                }
            });
        });
    }
}

Redactor.ParserLine = ParserLine;
/* jshint esversion: 6 */
class Unparser {
    constructor(app) {
        this.app = app;
        this.config = app.config;
        this.defaults = {
            type: 'html', // json
            state: false,
            clipboard: false,
        };
        this.parsedAttr = 'data-rx-type';
    }

    unparse(html, defaults = {}) {
        this.defaults = Redactor.extend(true, this.defaults, defaults);
        return this._unparse(html.trim());
    }

    unparseClasses($el) {
        const classesToRemove = [
            'rx-block-placeholder',
            'rx-block-focus',
            'rx-block-meta-focus',
            'rx-block-control-focus',
            'rx-layout-grid',
            'rx-nowrap',
            'rx-collapsed',
            'rx-hidden',
            'rx-drag-active'
        ];
        $el.removeClass(classesToRemove.join(' '));
        return $el;
    }

    // Private methods
    _unparse(html) {
        const storage = new CleanerStorage(this.app);
        const encoder = new CleanerEncoder(this.app);
        const utils = new Utils(this.app);
        const templateSyntax = this.config.get('templateSyntax');

        html = html.trim();
        html = this.app.emitHtml('editor.before.unparse', html);

        // Preprocessing
        if (this.app.has('email') && !this.defaults.clipboard) {
            html = this.app.email.unparseBlocks(html);
        }
        if (utils.isEmptyHtml(html)) return '';

        // Cleaning and restoring
        html = this._applyCleaners(html);

        // Parsing
        html = this._applyParsers(html);

        // Template syntax
        if (templateSyntax) {
            html = storage.restoreTemplateSyntax(html, templateSyntax);
        }

        // Final cleanup
        html = html === '<p></p>' ? '' : html;

        if (this.app.has('email')) {
            html = this.app.email.unparse(html);
        }

        html = encoder.decodeSpecialCharsInAttributes(html);
        html = html.replace(/&amp;/g, '&').replace(/&quot;(.*?)&quot;/gi, "'$1'");
        html = utils.replaceRgbToHex(html);

        html = this.app.emitHtml('editor.unparse', html);
        html = this._handleSelfClosingXmlTags(html);

        // decode entities
        if (!this.defaults.clipboard) {
            //html = encoder.decodeEntitiesInsidePreAndCode(html);
        }

        return html;
    }

    _handleSelfClosingXmlTags(html) {
        const selfClosingTags = this.config.get('paragraphizer.selfClosingXmlTags');
        if (!selfClosingTags) return html;

        selfClosingTags.forEach(tag => {
            const tagPattern = new RegExp(`<(${tag})([^>]*?)></\\1>`, 'gi');
            html = html.replace(tagPattern, '<$1$2 />');
        });

        return html;
    }

    _applyCleaners(html) {
        const transformer = new CleanerTransformer(this.app);
        const remover = new CleanerRemover(this.app);
        const cache = new CleanerCache(this.app);
        const storage = new CleanerStorage(this.app);
        const modifier = new CleanerModifier(this.app);

        html = transformer.revertForms(html);
        html = transformer.revertFrames(html);
        html = storage.store(html, 'noneditable');
        html = storage.store(html, 'embed');
        html = modifier.addNofollow(html);
        html = remover.removeMarkers(html);
        html = remover.removeInvisibleChars(html);
        html = storage.restore(html, 'noneditable');
        html = storage.restore(html, 'embed');
        html = cache.recacheStyle(html);
        html = remover.removeEmptyAttrs(html, ['style', 'class', 'rel', 'alt', 'title']);

        return html;
    }

    _applyParsers(html) {
        const remover = new CleanerRemover(this.app);
        const parser = new Parser(this.app);
        const classes = this.config.get('classes');

        html = parser.replaceTags(html);
        html = this._unparseAllTags(html);
        html = this._unparseDataType(html);
        html = this._unparseDataTag(html);
        html = remover.removeEmptyAttrs(html, ['style', 'class', 'rel', 'alt', 'title']);

        if (classes) {
            const utils = new Utils(this.app);
            const classApplier = new ClassApplier(this.app);
            html = utils.wrap(html, ($w) => {
                classApplier.parse($w);
            });
        }

        return html;
    }

    _unparseAllTags(html) {
        const utils = new Utils(this.app);
        return utils.wrap(html, ($w) => {
            $w.find('.rx-ai-main, .rx-inserted-node, #rx-image-resizer').remove();
            $w.find('*').removeAttr('contenteditable data-gramm_editor data-rx-cont-width data-offset-empty data-structure');
            if (!this.config.is('image.states')) {
                $w.find('img').removeAttr('data-image');
            }
        });
    }

    _unparseDataType(html) {
        const utils = new Utils(this.app);
        const remover = new CleanerRemover(this.app);

        return utils.wrap(html, ($w) => {
            const $elms = $w.find(`[${this.parsedAttr}]`);

            if (this.defaults.state !== true) {
                $elms.removeClass('rx-block-state');
            }

            $elms.removeAttr('tabindex data-rx-parsed data-rx-width data-rx-first-level data-rx-inline data-rx-focusable');
            this.unparseClasses($elms);
            $elms.each($el => this._unparseByType($el));
            $elms.removeAttr(this.parsedAttr);

            $w.find('figcaption')
                .removeAttr(`${this.parsedAttr} data-placeholder`)
                .each($el => remover.removeEmptyTag($el));
        });
    }

    _unparseByType($node) {
        const type = $node.attr(this.parsedAttr);
        if (type === 'embed') this._unparseEmbed($node);
        if (type === 'todo') this._unparseTodo($node);
        if (type !== 'pre') {
            //$node.html(this.encoder.decodeEntities($node.html()));
        }
    }

    _unparseDataTag(html) {
        const utils = new Utils(this.app);

        return utils.wrap(html, ($w) => {
            $w.find('[data-rx-tag]').each($node => {
                const tagType = $node.attr('data-rx-tag');
                $node.removeAttr('data-rx-tag');
                ['style', 'class'].forEach(attr => {
                    if ($node.attr(attr) === '') $node.removeAttr(attr);
                });

                if (!$node.get(0).attributes.length) {
                    this._unwrapNode($node, tagType, utils);
                }
            });
        });
    }

    _unwrapNode($node, tagType, utils) {
        if (utils.isEmptyHtml($node.html())) {
            $node.html('<br>').unwrap();
        } else if (tagType === 'tbr') {
            $node.unwrap();
        } else if ($node.get(0).lastChild?.tagName === 'BR') {
            $node.unwrap();
        } else {
            $node.append('<br>').unwrap();
        }
    }

    _unparseEmbed($node) {
        const code = decodeURI($node.attr('data-embed-content'));
        const $el = $node.find(`.${this.config.get('embed.classname')}`);
        $el.html(code);
        $node.removeAttr('data-embed-content');

        const $video = $el.find('video');
        if ($video.length) {
            const $figure = $el.closest('figure');
            if ($figure.find('figcaption').length === 0) {
                $figure.after($video);
                $figure.remove();
            }
        }
    }

    _unparseTodo($node) {
        const utils = new Utils(this.app);
        const itemTag = utils.findTodoItemTag();
        const ck = this.config.get('todo.templateItem');
        const ckd = this.config.get('todo.templateItemDone');
        const template = this.config.get('todo.template');

        $node.find('li').each($el => {
            const checked = $el.attr('data-checked') === '0' ? ck : ckd;

            $el.find(`[${this.parsedAttr}]`).removeAttr(this.parsedAttr);
            $el.removeAttr('data-checked');

            const content = $el.find(itemTag).html();
            let html = `${checked} ${content}`;
            if (template) {
                html = template.replace(/\$checked/gi, checked).replace(/\$content/gi, content);
            }

            $el.html(html);
        });
    }
}

Redactor.Unparser = Unparser;
class Cleaner {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;
        this.event = app.event;

        this.utils = new Utils(this.app);
        this.storage = new CleanerStorage(this.app);
        this.remover = new CleanerRemover(this.app);
        this.encoder = new CleanerEncoder(this.app);
        this.cache = new CleanerCache(this.app);
        this.docParser = new CleanerDocumentParser(this.app);
    }

    clean(html) {
        html = this.app.emitHtml('editor.before.clean', html);

        // Local variables
        const isPages = this._isPages(html);
        const isMsWord = this._isHtmlMsWord(html);
        const isEditor = this._isEditor(html);
        const isGdocs = this._isGDocs(html);

        const { pasteTags, inlineTags, formTags, deniedTags } = this._getTagsConfig();
        const tags = [...pasteTags, ...inlineTags, ...formTags];

        // Storing data
        html = this.storage.store(html, 'embed');
        html = this.storage.store(html, 'svg');
        html = this.storage.store(html, 'picture');

        // Unwrap link as block
        html = this._unwrapBlockLinks(html);

        // Removing unnecessary data
        html = this.remover.removeDoctype(html);
        html = this.remover.removeTags(html, deniedTags).trim();
        html = this.remover.removeFragmentEmptyTags(html);
        html = this.remover.removeComments(html);
        html = this.remover.removeTagsWithContent(html, ['script', 'style']);
        html = this.remover.removeSpanNbsp(html);

        // Transform todo
        html = this.transformTodoListItems(html);

        // Fixing div+br
        html = html.replace(/div><br\s?\/?><div/gi, 'div><br><br><div');

        // Cleaning Pages and GDocs
        html = isPages ? this.docParser.cleanPages(html) : html;
        html = isGdocs ? this.docParser.cleanGDocs(html) : html;

        // Strip attributes
        if (!isEditor && this.config.is('paste.stripAttr')) {
            const allowedAttributes = this.config.get('paste.stripAttr.allowedAttributes');
            const allowedClasses = this.config.get('paste.stripAttr.allowedClasses');
            html = this.remover.removeAllAttributes(html, { allowedAttributes, allowedClasses });
        }

        // Encoding PHP
        html = this.encoder.encodePhp(html);

        // Removing extra tags
        const exceptedTags = isEditor ? [...tags, 'div'] : tags;
        html = this.remover.removeTagsExcept(html, exceptedTags);

        // Cleaning MS Word
        html = isMsWord ? this.docParser.cleanMsWord(html) : html;

        // Removing classes and attributes
        const restored = this._removeClassesAttrs(html, isEditor);
        html = restored.html;

        // Restoring stored data
        if (!restored.flag) {
            html = this.storage.restore(html, 'embed');
        }
        html = this.storage.restore(html, 'svg');
        html = this.storage.restore(html, 'picture');

        // Working with styles
        html = isEditor ? this.cache.cacheStyle(html) : this.remover.removeStyleAttr(html);

        // Removing empty inline tags
        html = this.remover.removeEmptyInlines(html);
        html = this.remover.removeEmptySpans(html);

        // Cleaning empty blocks
        html = this._cleanEmptyBlocks(html, isEditor);

        // Fixing Gmail list paste issues
        html = this._fixGmailListPaste(html);

        // Tidying up extra line breaks
        html = this._tidyCleanUp(html);

        // Final event
        return this.app.emitHtml('editor.clean', html);
    }

    transformTodoListItems(html) {
        const template = document.createElement('template');
        template.innerHTML = html;

        const root = template.content;
        const config = this.app.config;
        const templateUnchecked = config.get('todo.templateItem') || '[ ]';
        const templateChecked = config.get('todo.templateItemDone') || '[x]';

        root.querySelectorAll('li[data-checked]').forEach(li => {
            const isChecked = li.getAttribute('data-checked') === '1';
            const template = isChecked ? templateChecked : templateUnchecked;

            const textEl = li.querySelector('div');
            const text = textEl ? textEl.textContent.trim() : li.textContent.trim();

            const result = template + ' ' + text;
            li.innerHTML = result;

            li.removeAttribute('data-checked');
        });

        return template.innerHTML;
    }

    cleanAttributes(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        doc.querySelectorAll("*").forEach(el => {
            [...el.attributes].forEach(attr => {
                if (attr.name === '"') return;
                const cleanedValue = attr.value.replace(/\s*\n\s*/g, ' ').trim();
                el.setAttribute(attr.name, cleanedValue);
            });
        });

        return doc.body.innerHTML;
    }

    // Private methods

    _isEditor(html) {
        return html.match(new RegExp('meta\\stype="rx-editor"', 'i'));
    }

    _isGDocs(html) {
        return (html.search(/docs-internal-guid/i) !== -1);
    }

    _isPages(html) {
        return html.match(/name="Generator"\scontent="Cocoa\sHTML\sWriter"/i);
    }

    _isHtmlMsWord(html) {
        return html.match(/class="?Mso|style="[^"]*\bmso-|style='[^'']*\bmso-|w:WordDocument/i);
    }

    _getTagsConfig() {
        return {
            pasteTags: this.config.get('paste.blockTags'),
            inlineTags: this.config.get('paste.inlineTags'),
            formTags: this.config.get('paste.formTags'),
            deniedTags: this.config.get('tags.denied')
        };
    }

    _cleanEmptyBlocks(html, isEditor) {
        html = html
            .replace(/<figure[^>]*><\/figure>/gi, '')
            .replace(/<p>&nbsp;<\/p>/gi, '<p></p>')
            .replace(/<p><br\s?\/?><\/p>/gi, '<p></p>');

        if (!isEditor && !this.config.is('paste.keepEmptyLines')) {
            html = html.replace(/<p[^>]*><\/p>/gi, '')
        }

        return html;
    }

    _fixGmailListPaste(html) {
        return html
            .replace(/^<li/gi, '<ul><li')
            .replace(/<\/li>$/gi, '</li></ul>')
            .replace(/<br\s?\/?><\/li>/gi, '</li>')
            .replace(/<span><br\s?\/?>{1,2}<\/span>/gi, '')
            .replace(/<br\s?\/?><br\s?\/?>$/gi, '');
    }

    _tidyCleanUp(html) {
        return this.utils.wrap(html, ($w) => {
            $w.find('.Apple-converted-space').unwrap();
            $w.find('ul, ol').each(this._placeListToItem.bind(this));
            $w.find('li p').unwrap();
        });
    }

    _unwrapBlockLinks(html) {
        return this.utils.wrap(html, ($w) => {
            const blockTags = 'p, div, h1, h2, h3, h4, h5, h6, section, article, table, ul, ol, blockquote, figure, aside, pre';

            $w.find('a').each(($a) => {
                if ($a.find(blockTags).length) {
                    $a.replaceWith($a.html());
                }
            });
        });
    }

    _placeListToItem($node) {
        let node = $node.get();
        let prev = node.previousSibling;
        if (prev && prev.tagName === 'LI') {
            let $li = this.dom(prev);
            $li.find('p').unwrap();
            $li.append(node);
        }
    }

    _removeClassesAttrs(html, isEditor) {
        let restored = false;
        const keepClass = this.config.get('paste.keepClass');
        const keepAttrs = this.config.get('paste.keepAttrs');
        const filterClass = keepClass.length ? keepClass.join(',') : '';
        const filterAttrs = keepAttrs.length ? keepAttrs.join(',') : '';

        // Processing of insertion events
        if (!isEditor && this.event.isPasteEvent()) {
            html = this.storage.restore(html, 'embed');
            restored = true;
        }

        // Removing classes and attributes
        if (!isEditor) {
            html = this.utils.wrap(html, ($w) => {
                const $elms = $w.find('*');
                $elms.not(filterClass).each($node => $node.removeAttr('class'));
                $elms.not(filterAttrs).each(($node) => {
                    if ($node.data('keep-style')) {
                        $node.attr('data-rx-style-cache', $node.attr('style'));
                        $node.removeAttr('data-keep-style');
                        return;
                    }

                    const node = $node.get();
                    Array.from(node.attributes).forEach((attr) => {
                        if (this._isRemovableAttribute(attr.name, node)) {
                            node.removeAttribute(attr.name);
                        }
                    });
                });
            });
        }

        return { html, flag: restored };
    }

    _isRemovableAttribute(name, node) {
        const isSpecialTag = (node.tagName === 'IMG' && ['src', 'srcset', 'alt', 'data-state-src', 'data-state-srcset'].includes(name)) ||
                             (node.tagName === 'A' && ['href', 'target'].includes(name));

        return name !== 'class' && name !== 'dir' && !name.startsWith('data-') && !isSpecialTag;
    }


    // @deprecated 5.0
    store(html, name) {
        return this.storage.store(html, name);
    }

    restore(html, name) {
        return this.storage.restore(html, name)
    }

    cacheElementStyle($el) {
        this.cache.cacheElementStyle($el);
    }
}

Redactor.Cleaner = Cleaner;
class CleanerCache {
    constructor(app) {
        this.app = app;
        this.config = app.config;

        // Prepare selector
        const tags = this.config.get('tags');
        this.selector = [...tags.block, 'img', ...tags.inline].join(',');
    }

    cacheStyle(html) {
        return this._transformStyle(html, this.cacheElementStyle.bind(this));
    }

    cacheElementStyle($el) {
        const style = $el.attr('style');
        if (style) {
            $el.attr('data-rx-style-cache', style.replace(/"/g, ''));
        } else {
            $el.removeAttr('data-rx-style-cache');
        }
    }

    recacheStyle(html) {
        return this._transformStyle(html, this._recacheElementStyle.bind(this), '[data-rx-style-cache]');
    }

    // Private methods

    _transformStyle(html, transformFn, selector = this.selector) {
        const utils = new Utils(this.app);
        return utils.wrap(html, ($w) => {
            $w.find(selector).each(transformFn);
        });
    }

    _recacheElementStyle($el) {
        const cachedStyle = $el.attr('data-rx-style-cache');
        if (cachedStyle) {
            $el.attr('style', cachedStyle).removeAttr('data-rx-style-cache');
        }
    }
}

Redactor.CleanerCache = CleanerCache;
class CleanerDocumentParser {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;

        this.utils = new Utils(app);
    }

    cleanPages(html) {
        html = html.replace(/\sclass="s[0-9]"/gi, '');
        html = html.replace(/\sclass="p[0-9]"/gi, '');
        return html;
    }

    cleanGDocs(html) {
        return this.utils.wrap(html, ($w) => {
            $w.find('h1, h2, h3, h4, h5, h6').each(($node) => {
                $node.find('span').unwrap();
            });
        }).replace(/ dir="[^>]*"/gi, '')
          .replace(/<b\sid="internal-source-marker(.*?)">([\w\W]*?)<\/b>/gi, "$2")
          .replace(/<b(.*?)id="docs-internal-guid(.*?)">([\w\W]*?)<\/b>/gi, "$3")
          .replace(/<span[^>]*(font-style:\s?italic;\s?font-weight:\s?(bold|600|700)|font-weight:\s?(bold|600|700);\s?font-style:\s?italic)[^>]*>([\w\W]*?)<\/span>/gi, '<b><i>$4</i></b>')
          .replace(/<span[^>]*font-style:\s?italic[^>]*>([\w\W]*?)<\/span>/gi, '<i>$1</i>')
          .replace(/<span[^>]*font-weight:\s?(bold|600|700)[^>]*>([\w\W]*?)<\/span>/gi, '<b>$2</b>');
    }

    cleanMsWord(html) {
        html = html.replace(/<!--[\s\S]+?-->/gi, '');
        html = html.trim();
        html = html.replace(/<(!|script[^>]*>.*?<\/script(?=[>\s])|\/?(\?xml(:\w+)?|meta|link|style|\w:\w+)(?=[\s/>]))[^>]*>/gi, '');
        html = html.replace(/<(\/?)s>/gi, "<$1strike>");
        html = html.replace(/&nbsp;/gi, ' ');
        html = html.replace(/<span\s+style\s*=\s*"\s*mso-spacerun\s*:\s*yes\s*;?\s*"\s*>([\s\u00a0]*)<\/span>/gi, (str, spaces) => {
            return (spaces.length > 0) ? spaces.replace(/./, " ").slice(Math.floor(spaces.length/2)).split("").join("\u00a0") : '';
        });

        html = this.utils.wrap(html, ($w) => {
            $w.find('p').each(($node) => {
                let matches = /mso-list:\w+ \w+([0-9]+)/.exec($node.attr('style'));
                if (matches) {
                    $node.attr('data-listLevel', parseInt(matches[1], 10));
                }
            });

            this._parseWordLists($w);
            $w.find('[align]').removeAttr('align');

            if (!this.config.is('paste.keepNameAttr')) {
                $w.find('[name]').removeAttr('name');
            }

            const keep = this.config.get('paste.keepWordFormatting') || {};
            const allowedStyles = Array.isArray(keep.styles) ? keep.styles : [];

            $w.find('span').each(($node) => {
                const style = $node.attr('style') || '';

                if (/mso-list:Ignore/.test(style) || $node.html().trim() === '') {
                    $node.remove();
                    return;
                }

                if (allowedStyles.length > 0) {
                    const styleObj = {};
                    style.split(';').forEach((rule) => {
                        let [prop, val] = rule.split(':');
                        if (!prop || !val) return;
                        prop = prop.trim().toLowerCase();
                        val = val.trim();
                        if (allowedStyles.includes(prop)) {
                            styleObj[prop] = val;
                        }
                    });

                    if (Object.keys(styleObj).length > 0) {
                        const newStyle = Object.entries(styleObj).map(([k, v]) => `${k}: ${v}`).join('; ');
                        $node.attr('style', newStyle);
                        Array.from($node.get().attributes).forEach(attr => {
                            if (attr.name !== 'style') {
                                $node.removeAttr(attr.name);
                            }
                        });
                        $node.attr('data-keep-style', true);
                    } else {
                        $node.unwrap();
                    }
                } else {
                    $node.unwrap();
                }
            });

            $w.find('[style]').each($node => {
                if (!$node.data('keep-style')) {
                    $node.removeAttr('style');
                }
            });
            $w.find("[class^='Mso']").removeAttr('class');
            $w.find('a').filter(($node) => !$node.attr('href')).unwrap();
        })

        html = html.replace(/<p><img(.*?)>/gi, "<p><img$1></p><p>")
          .replace(/<li>·/gi, '<li>');

        if (!this.config.is('paste.keepEmptyLines')) {
            html = html.replace(/<p[^>]*><\/p>/gi, '');
        }

        html = html.trim();

        // remove spaces between
        html = html.replace(/\/(p|ul|ol|h1|h2|h3|h4|h5|h6|blockquote)>\s+<(p|ul|ol|h1|h2|h3|h4|h5|h6|blockquote)/gi, '/$1>\n<$2');

        let result = '';
        let lines = html.split(/\n/);
        let max = lines.length;
        for (let i = 0; i < max; i++) {
            let space = (lines[i] !== '' && lines[i].search(/>$/) === -1) ? ' ' : '\n';
            result += lines[i] + space;
        }

        //result = result.replace(/<p>\s?<\/p>/gi, '');
        result = result.trim();

        return result;
    }

    // Private methods

    _parseWordLists($w) {
        let lastLevel = 0,
            $item = null,
            $list = null,
            $listChild = null;

        $w.find('p').each(($node) => {
            let level = $node.attr('data-listLevel');
            if (level === null && $node.hasClass('MsoListParagraphCxSpMiddle')) {
                level = 1;
            }

            if (level !== null) {
                let txt = $node.text();
                let listTag = (/^\s*\w+\./.test(txt)) ? '<ol></ol>' : '<ul></ul>';

                // new parent list
                if ($node.hasClass('MsoListParagraphCxSpFirst') || $node.hasClass('MsoNormal')) {
                    $list = this.dom(listTag);
                    $node.before($list);

                // new child list
                } else if (level > lastLevel && lastLevel !== 0) {
                    $listChild = this.dom(listTag);
                    $item.append($listChild);
                    $list = $listChild;
                }

                // level up
                if (level < lastLevel) {
                    let len = lastLevel - level + 1;
                    for (let i = 0; i < len; i++) {
                        $list = $list.parent();
                    }
                }

                // create item
                $node.find('span').first().unwrap();
                $item = this.dom('<li>' + $node.html().trim() + '</li>');
                if (!$list) {
                    $node.before(listTag);
                    $list = $node.prev();
                }

                $list.append($item);
                $node.remove();
                lastLevel = level;
            } else {
                $list = null;
                lastLevel = 0;
            }
        });
    }
}

Redactor.CleanerDocumentParser = CleanerDocumentParser;
class CleanerEncoder {
    constructor(app) {
        this.app = app;
        this.config = app.config;
        this.selector = 'pre code, pre, code';
    }

    escapeHtml(str) {
        return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    encodeEntities(str) {
        return this.decodeEntities(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    encodePhp(html) {
        return html.replace(/<\?(php)?/g, '&lt;?$1')
                   .replace(/\?>/g, '?&gt;');
    }

    decodeEntitiesOutsidePreAndCode(html) {
        const decode = (str) => {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = str;
            return textarea.value;
        };

        const placeholders = [];
        const placeholderPrefix = '%%%PLACEHOLDER%%%';

        html = html.replace(/<(pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi, match => {
            const index = placeholders.length;
            placeholders.push(match);
            return `${placeholderPrefix}${index}%%%`;
        });

        const decoded = decode(html);
        const restored = decoded.replace(new RegExp(`${placeholderPrefix}(\\d+)%%%`, 'g'), (_, index) => {
            return placeholders[Number(index)];
        });

        return restored;
    }

    decodeEntitiesInsidePreAndCode(html) {
        const decode = (str) => {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = str;
            return textarea.value;
        };

        html = html.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (match, attrs, content) => {
            return `<pre${attrs}>${decode(content)}</pre>`;
        });

        html = html.replace(/<code\b([^>]*)>([\s\S]*?)<\/code>/gi, (match, attrs, content) => {
            return `<code${attrs}>${decode(content)}</code>`;
        });

        return html;
    }

    encodeCode(html) {
        // Fix php tags
        html = html
          .replace(/<\/code--><\/code><\/pre><code>/gi, '</code></pre>')
          .replace(/<\/pre-->/gi, '</pre>')
          .replace(/=-->/gi, '=>');

        // First, encode all attributes
        html = this.encodeAttrSings(html);

        // Replace all tags with temporary markers
        html = html.replace(/<\s/gi, '&lt; ')
                   .replace(/<([^>]+)</gi, '&lt;$1<')
                   .replace(/<(.*?)>/gi, 'xtagstartz$1xtagendz');

        // Restore pre / code tags
        html = html.replace(/xtagstartzpre(.*?)xtagendz/g, '<pre$1>')
                   .replace(/xtagstartzcode(.*?)xtagendz/g, '<code$1>')
                   .replace(/xtagstartz\/codextagendz/g, '</code>')
                   .replace(/xtagstartz\/prextagendz/g, '</pre>');

        // Restore php tags
        html = html
          .replace(/&lt;!--\?(php)?/gi, '&lt;?$1')
          .replace(/\?--&gt/g, '?&gt;')
          .replace(/<!--\?(php)?/gi, '&lt;?$1')
          .replace(/\?-->/g, '?&gt;');

        // Perform encoding of content inside pre and code
        html = this._encodeCode(html);

        // Restore all tags from temporary markers
        html = html.replace(/xtagstartz([\w\W]*?)xtagendz/g, '<$1>')
                   .replace(/xtagstartz\/(.*?)xtagendz/g, '</$1>');

        // Decode special characters if they were changed
        html = this.decodeAttrSings(html);

        return html;
    }

    _encodeCodeContent(content) {
        return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    encodeAttrSings(html) {
        return html.replace(/="(.*?)"/g, (match) => {
            return match.replace(/</g, 'xlesssignz')
                        .replace(/>/g, 'xmoresignz');
        });
    }

    decodeAttrSings(html) {
        return html.replace(/xlesssignz/g, '<')
                   .replace(/xmoresignz/g, '>');
    }

    decodeEntities(str) {
        return str.replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&amp;/g, '&');
    }

    decodeHref(html) {
        return html.replace(/href="(.*?)&amp;(.*?)"/g, 'href="$1&$2"');
    }

    decodeSpecialCharsInAttributes(html) {
        return html.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, tag, attributes) => {
            const decodedAttributes = attributes.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (attr) => attr.replace(/&amp;/g, '&'));
            return `<${tag}${decodedAttributes}>`;
        });
    }

    _encodeCode(html) {
        const utils = new Utils(this.app);
        return utils.wrap(html, ($w) => {
            $w.find(this.selector).each(($node) => this._encodeNode($node));
        });
    }

    _encodeNode($node) {
        let node = $node.get();
        if ($node.tag('pre') && node.firstChild?.tagName === 'CODE') return;

        let html = node.innerHTML.replace(/xtagstartz/g, '<')
         .replace(/xtagendz/g, '>');

        if (node.tagName === 'CODE' && node.parentNode.tagName !== 'PRE') {
            node.textContent = this.encodeEntities(html);
        } else {
            node.textContent = this._encodeNodeHtml(this.decodeEntities(html));
        }
    }

    _encodeNodeHtml(html) {
        const spaces = this.config.get('pre.spaces');
        html = html.replace(/&nbsp;/g, ' ').replace(/<br\s?\/?>/g, '\n');
        return (spaces) ? html.replace(/\t/g, new Array(spaces + 1).join(' ')) : html;
    }
}

Redactor.CleanerEncoder = CleanerEncoder;
class CleanerModifier {
    constructor(app) {
        this.app = app;
        this.config = app.config;
    }

    addNofollow(html) {
        const utils = new Utils(this.app);
        return (!this.config.is('link.nofollow')) ? html : utils.wrap(html, ($w) => {
            $w.find('a').attr('rel', 'nofollow');
        });
    }

    addHttps(html) {
        const re = /(href|src|srcset)="http:\/\//gi;
        return (this.config.is('https')) ? html.replace(re, '$1="https://') : html;
    }

    addBrToBlocks(html) {
        return html.replace(/<\/(div|li|dt|dd|td|p|h[1-6])>\n?/gi, '</$1><br>');
    }
}

Redactor.CleanerModifier = CleanerModifier;
class CleanerRemover {
    constructor(app) {
        this.app = app;
        this.config = app.config;
        this.utils = new Utils(this.app);
        this.tags = this.config.get('tags');
        this.blockListTags = this.utils.removeFromArrayByValue(this.tags.block.concat(), ['ul', 'ol', 'li']);
        this.inlines = this.utils.removeFromArrayByValue(this.tags.inline, 'a');
    }

    removeDoctype(html) {
        return html.replace(new RegExp("<!doctype[^>]*>", 'gi'), '');
    }

    removeFragmentEmptyTags(html) {
        if (!html.startsWith('<!--StartFragment-->')) {
            return html;
        }

        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(
            /^<!--StartFragment-->(?:<span[^>]*>\s*){1,2}([\s\S]*?)(?:<\/span>\s*){1,2}$/,
            '<!--StartFragment-->$1'
        );

        return html;
    }

    removeComments(html) {
        html = html.replace(/<!--StartFragment-->/g, '');
        html = html.replace(/<!--EndFragment-->/g, '');

        return html.replace(/<!--[\s\S]*?-->\n?/g, '');
     }

    removeInvisibleChars(str) {
        return str.replace(/\uFEFF/g, '');
    }

    removeMarkers(html) {
        return this.utils.wrap(html, ($w) => {
            $w.find('.rx-plus-button').remove();
            $w.find('.rx-pastemarker').removeClass('rx-pastemarker');
            $w.find('.rx-pasteitems').removeClass('rx-pasteitems');
            $w.find('.rx-selection-marker').remove();
        });
    }

    removeEmptySpans(html) {
        return this.utils.wrap(html, ($w) => {
            $w.find('span').each(this.removeEmptySpan.bind(this));
        });
    }

    removeSpanNbsp(html) {
        return this.utils.wrap(html, ($w) => {
            $w.find('span').each($node => {
                if ($node.html() === '&nbsp;') {
                    $node.html(' ').unwrap();
                }
            });
        });
    }

    removeAllAttributes(html, options) {
        const keepAttrs = {
            a: ['href', 'target'],
            img: ['src', 'srcset', 'alt', 'data-state-src', 'data-state-srcset']
        };

        const allowedAttributes = options.allowedAttributes || [];
        const allowedClasses = options.allowedClasses || [];

        html = this.utils.wrap(html, ($w) => {
            $w.find('*').each($node => {
                const allowed = new Set(keepAttrs[$node.tag()] || []);
                const el = $node.get();
                Array.from(el.attributes).forEach(attr => {
                    if (attr.name === 'class') {
                        const classes = el.className.split(/\s+/).filter(cls => allowedClasses.includes(cls.toLowerCase()));
                        if (classes.length > 0) {
                            el.className = classes.join(' ');
                        } else {
                            el.removeAttribute('class');
                        }
                    } else if (!allowed.has(attr.name)) {
                        if (allowedAttributes && allowedAttributes.includes(attr.name)) return;
                        el.removeAttribute(attr.name);
                    }
                });
            });
        });

        return html;
    }



    removeEmptyInlines(html) {
        return this.utils.wrap(html, ($w) => {
            $w.find(this.tags.inline.join(',')).each(this.removeEmptyTag.bind(this));
        });
    }

    removeEmptyAttrs(html, attrs) {
        return this.utils.wrap(html, ($w) => {
            for (var i = 0; i < attrs.length; i++) {
                $w.find('[' + attrs[i] + '=""]').removeAttr(attrs[i]);
            }
        });
    }

    removeEmptyTag($node) {
        let html = $node.html().trim();
        if ($node.get().attributes.length === 0 && html === '') {
            $node.unwrap();
        }
    }

    removeEmptySpan($node) {
        if ($node.get().attributes.length === 0) {
            $node.unwrap();
        }
    }

    removeTags(input, denied) {
        const re = (denied) ? /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi : /(<([^>]+)>)/gi;
        const replacer = (!denied) ? '' : ($0, $1) => {
            return denied.indexOf($1.toLowerCase()) === -1 ? $0 : '';
        };

        return input.replace(re, replacer);
    }

    removeTagsWithContent(html, tags) {
        return this.utils.wrap(html, ($w) => {
            $w.find(tags.join(',')).remove();
        });
    }

    removeTagsExcept(input, except) {
        const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
        return input.replace(tags, ($0, $1) => except.includes($1.toLowerCase()) ? $0 : '');
    }

    removeBlockTags(html, tags, except) {
        let blocks = [...this.tags.block];
        if (except) blocks = this.utils.removeFromArrayByValue(blocks, except);
        if (tags) blocks = this.utils.extendArray(blocks, tags);
        return this.removeTags(html, blocks);
    }

    removeBlockTagsInside(html, tags) {
        return this.utils.wrap(html, ($w) => {
            $w.find(tags.join(',')).each(this._removeBlockTagsInside.bind(this));
        });
    }

    removeInlineStyles(html) {
        return this.utils.wrap(html, ($w) => {
            $w.find(this.inlines.join(',')).removeAttr('style');
        });
    }

    removeStyleAttr(html, filter) {
        filter = filter || '';

        return this.utils.wrap(html, ($w) => {
            $w.find('*').not('[data-rx-style-cache]' + filter).removeAttr('style');
        });
    }

    removeBreakline(html) {
        return html.replace(/<br\s?\/?>/gi, '');
    }

    // Private methods

    _removeBlockTagsInside($node) {
        let tags = $node.tag('li') ? this.blockListTags : this.tags.block;
        $node.find(tags.join(',')).append('<br>').unwrap();
    }
}

Redactor.CleanerRemover = CleanerRemover;
class CleanerStorage {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;

        // local
        this.stored = {};
        this.storedIndex = 0;
        this.storedComments = [];
        this._selectors = {
            code: ['pre', 'code'],
            embed: ['figure'],
            picture: ['picture'],
            noneditable: [`[${app.opts.get('dataBlock')}=noneditable]`],
            noparse: ['[data-noparse]'],
            images: ['img'],
            svg: ['svg'],
            links: ['a'],
            lists: ['ul', 'ol'],
            headings: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
        };
    }

    store(html, name) {
        return this._processStorage(html, name, this._selectors[name], this._store.bind(this));
    }

    storeComments(html) {
        let comments = html.match(/<!--([\w\W]*?)-->/gi);
        if (!comments) return html;

        html = this.store(html, 'code');
        comments.forEach((comment, i) => {
            html = html.replace(comment, `#####xstarthtmlcommentzz${i}xendhtmlcommentzz#####`);
            this.storedComments.push(comment);
        });

        return this.restore(html, 'code');
    }

    storeTemplateSyntax(html, delims) {
        Object.entries(delims).forEach(([key, item]) => {
            const name = `ts__${key}`;
            html = html.replace(new RegExp(`${item[0]}(.*?)${item[1]}`, 'gi'), `<!--${name}$1${name}-->`);
        });
        return html;
    }

    restore(html, name) {
        const storedItems = this.stored[name];
        if (!storedItems) return html;

        storedItems.forEach((item, i) => {
            html = html.replace(`####_${name}${i}_####`, item);
        });
        return html;
    }

    restoreComments(html) {
        this.storedComments.forEach((comment, i) => {
            const safeComment = comment.replace(/\$/g, '&#36;');
            html = html.replace(`#####xstarthtmlcommentzz${i}xendhtmlcommentzz#####`, safeComment);
        });
        return html;
    }

    restoreTemplateSyntax(html, delims) {
        const utils = new Utils(this.app);
        Object.entries(delims).forEach(([key, item]) => {
            const name = `ts__${key}`;
            html = html.replace(new RegExp(`<!--${name}(.*?)${name}-->`, 'gi'), utils.escapeBackslash(item[0]) + '$1' + utils.escapeBackslash(item[1]));
        });

        return html.replace(/\{\{&gt;/gi, '{{>');
    }

    // Private methods

    _processStorage(html, name, selectors, storeFn) {
        selectors.forEach(selector => {
            const matched = this._getElementsFromHtml(html, selector);
            html = storeFn(html, name, matched);
        });
        return html;
    }

    _store(html, name, matched) {
        if (!matched.length) return html;

        this.stored[name] = this.stored[name] || [];
        matched.forEach(item => {
            this.stored[name][this.storedIndex] = item;
            html = html.replace(item, `####_${name}${this.storedIndex}_####`);
            this.storedIndex++;
        });
        return html;
    }

    _getElementsFromHtml(html, selector) {
        const matched = [];

        const template = document.createElement('template');
        template.innerHTML = html;

        const nodes = template.content.querySelectorAll(selector);

        nodes.forEach(node => {
            matched.push(node.outerHTML);
        });

        return matched;
    }
}

Redactor.CleanerStorage = CleanerStorage;
class CleanerTransformer {
    constructor(app) {
        this.app = app;
    }

    convertForms(html) {
        return this._transform(html, 'form', this._convertForm);
    }

    convertVideo(html) {
        return this._transform(html, 'video', this._convertVideo);
    }

    convertFrames(html) {
        return this._transform(html, 'iframe', this._convertFrame);
    }

    convertSvgSpan(html) {
        return this._transform(html, 'svg', this._convertSvgSpan);
    }

    revertForms(html) {
        return this._transform(html, '.rx-div-form', this._revertForm);
    }

    revertFrames(html) {
        return this._transform(html, '.rx-figure-iframe', this._revertFrame);
    }

    revertSvgSpan(html) {
        return this._transform(html, 'svg', this._revertSvgSpan);
    }

    // Private methods

    _transform(html, selector, transformFn) {
        const utils = new Utils(this.app);
        return utils.wrap(html, ($w) => {
            $w.find(selector).each($node => transformFn($node));
        });
    }

    _convertForm($node) {
        $node.replaceTag('div').addClass('rx-div-form');
    }

    _convertVideo($node) {
        if (!$node.closest('figure').length) {
            $node.wrap('<figure>');
        }
    }

    _convertFrame($node) {
        if (!$node.closest('figure').length) {
            $node.wrap('<figure>').parent().addClass('rx-figure-iframe');
        }
    }

    _convertSvgSpan($node) {
        const $parent = $node.parent();
        if ($parent.is('span')) {
            $parent.attr('contenteditable', false);
        }
    }

    _revertForm($node) {
        $node.replaceTag('form').removeClass('rx-div-form');
    }


    _revertFrame($node) {
        if ($node.get().attributes.length === 0 && !$node.find('figcaption, div').length) {
            $node.unwrap();
        } else {
            $node.removeClass('rx-figure-iframe');
        }
    }

    _revertSvgSpan($node) {
        const $parent = $node.parent();
        if ($parent.is('span')) {
            $parent.removeAttr('contenteditable');
        }
    }
}

Redactor.CleanerTransformer = CleanerTransformer;
class Sanitizer {
    constructor(app) {
        this.app = app;
    }

    sanitize(html) {
        const comments = [];
        const placeholder = '__HTML_COMMENT__';

        // html = html.replace(/<!--[\s\S]*?-->/g, match => {
        //     comments.push(match);
        //     return `${placeholder}${comments.length - 1}__`;
        // });

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const body = doc.body;
        const all = body.querySelectorAll('*');

        for (const el of all) {
            if (el.hasAttribute('src')) this._sanitizeSrc(el);
            if (el.tagName === 'A' && el.hasAttribute('href')) this._sanitizeHref(el);
            if (el.hasAttribute('srcdoc')) el.removeAttribute('srcdoc');

            this._removeEventAttributes(el);
        }

        let result = body.innerHTML;
        //result = result.replace(new RegExp(`${placeholder}(\\d+)__`, 'g'), (_, i) => comments[i]);

        return result;
    }

    _sanitizeSrc(el) {
        const src = el.getAttribute('src');
        if (!src) return;

        const value = src.trim().toLowerCase();
        if (value.startsWith('javascript:') || (!['IMG'].includes(el.tagName) && value.startsWith('data:'))) {
            el.setAttribute('src', '');
        }
    }

    _sanitizeHref(el) {
        const href = el.getAttribute('href');
        if (!href) return;

        const value = href.trim().toLowerCase();
        if (value.startsWith('javascript:')) {
            el.setAttribute('href', '');
        }
    }

    _removeEventAttributes(el) {
        const attrs = el.attributes;
        for (let i = attrs.length - 1; i >= 0; i--) {
            const attr = attrs[i];
            if (/^on/i.test(attr.name)) {
                el.removeAttribute(attr.name);
            }
        }
    }
}

Redactor.Sanitizer = Sanitizer;
class ElementInspector {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;
        this.editor = app.editor;

        this.blockTags = this.config.get('tags.block');
        this.inlineTags = this.config.get('tags.inline');
    }

    is(el, type, filter = true) {
        const node = (type === 'text') ? el : this._node(el);
        const typeHandlers = {
            'inline': () => this._isElement(node) && this._isInlineTag(node.tagName, filter && node),
            'block-data': () => this._isElement(node) && node.hasAttribute('data-rx-type'),
            'block-data-not-inline': () => this._isElement(node) && node.hasAttribute('data-rx-type') && !node.hasAttribute('data-rx-inline'),
            'block-first': () => this._isElement(node) && node.hasAttribute('data-rx-first-level'),
            'block': () => this._isElement(node) && this._isBlockTag(node.tagName),
            'element': () => this._isElement(node),
            'text': () => (typeof node === 'string' && !/^\s*<(\w+|!)[^>]*>/.test(node)) || this._isTextNode(node),
            'list': () => this._isElement(node) && ['ul', 'ol'].includes(node.tagName.toLowerCase()),
            'heading': () => this._isElement(node) && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName.toLowerCase())
        };
        return typeHandlers[type] ? typeHandlers[type]() : false;
    }

    isTool(el) {
        return this.dom(el).closest('.rx-in-tool').length > 0;
    }

    isType(el, type) {
        return type == this.getType(el);
    }

    isTag(el, tag) {
        return this._node(el).tagName.toLowerCase() === tag;
    }

    isEmpty(el) {
        let node = this._node(el);
        return node ? (node.nodeType === 3 ? !node.textContent.trim().replace(/\n/, '') : !node.innerHTML) : true;
    }

    isElementVisibleInScroll(element) {
        const container = this.editor.getEditor();
        const containerRect = this.dom(container).get().getBoundingClientRect();
        const elementRect = this.dom(element).get().getBoundingClientRect();

        return elementRect.top >= containerRect.top &&  elementRect.bottom <= containerRect.bottom;
    }

    getInlines(el, tag) {
        if (!el) return [];

        let node = this._node(el);
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode;
        }

        const inlineParents = [];
        while (node) {
            if (node.nodeType === Node.ELEMENT_NODE && this.is(node, 'inline')) {
                if (node.tagName.toLowerCase() === tag) break;
                inlineParents.push(node);
            }
            node = node.parentNode;
        }

        return inlineParents;
    }

    getType(el) {
        return this.dom(el).attr('data-rx-type');
    }

    getDataBlock(el, type) {
        const selector = type ? `[data-rx-type=${type}]` : '[data-rx-type]';
        const $el = this.dom(el).closest(selector);
        return $el.length ? $el : false;
    }

    getFirstLevel(el) {
        return this.dom(el).closest('[data-rx-first-level]');
    }

    getBlocks(el, parserTags) {
        const node = this._node(el);
        let tags = parserTags || this.config.get('tags.parser');
        tags = [...tags, ...Redactor.customTags];
        const finalNodes = Array.from(node.childNodes).filter(node =>
            node.nodeType === 1 && tags.includes(node.tagName.toLowerCase())
        );

        return finalNodes;
    }

    hasAttrs(el, attrs) {
        const $el = this.dom(el);
        return Object.entries(attrs).every(([key, val]) => $el.attr(key) === val);
    }

    hasStyle(el, styles) {
        if (!styles) return false;
        const $el = this.dom(el);
        return Object.entries(styles).every(([key, val]) => {
            const styleValue = $el.css(key);
            return this._normalizeValue(key, styleValue) === this._normalizeValue(key, val);
        });
    }

    hasParent(el, type) {
        return this.dom(el).closest('[data-rx-type='+ type +']').length !== 0;
    }

    compareStyle(el, obj) {
        const utils = new Utils(this.app);
        const $el = this.dom(el);
        const css = utils.cssToObject($el.attr('style'));

        // First, check if both objects have the same number of properties
        if (Object.keys(css).length !== Object.keys(obj).length) {
            return false;
        }

        // Then, verify every style property matches
        return Object.entries(obj).every(([key, expectedValue]) => {
            const actualValue = css[key];
            if (actualValue === undefined) {
                return false;
            }
            return this._normalizeValue(key, actualValue) === this._normalizeValue(key, expectedValue);
        });
    }

    // Private methods

    _node(el) {
        return this.dom(el).get();
    }

    _isTag(tag) {
        return (tag !== undefined && tag);
    }

    _isTextNode(node) {
        return node && node.nodeType === 3;
    }

    _isBlockTag(tag) {
        return this.blockTags.includes(tag.toLowerCase());
    }

    _isInlineTag(tag, node) {
        return this.inlineTags.includes(tag.toLowerCase()) && (!node || !this.dom(node).hasClass('email-button'));
    }

    _isElement(node) {
        return (node && node.nodeType && node.nodeType === 1);
    }

    _normalizeValue(key, val) {
        const utils = new Utils(this.app);

        val = (typeof val === 'string') ? val.replace(/'/g, '"') : val;
        val = val || '';
        val = val.trim().replace(/;$/, '');
        if (key.includes('color') || key.includes('background')) {
            val = utils.convertRgbToHex(val);
            val = val.toLowerCase();
        }
        if (key.includes('family')) {
            val = val.replace(/"/g, '');
        }

        return val;
    }
}

Redactor.ElementInspector = ElementInspector;
class ElementSplitter {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
    }

    split(el, append = true) {
        const inspector = new ElementInspector(this.app);
        const utils = new Utils(this.app);
        const $originalElement = this.dom(el);
        const node = this.dom(el).get();
        const tag = node.tagName.toLowerCase();
        const fragment = utils.extractHtmlFromCaret(el);
        const $newElement = this.dom(`<${tag}>`);

        // Clone attributes from the original element to the new one
        $originalElement.cloneAttrs($newElement);

        // If the fragment is a DocumentFragment (nodeType 11), append its child nodes to the new element
        if (fragment.nodeType === 11) {
            $newElement.append(this.dom(fragment));
        } else {
            $newElement.append(fragment);
        }

        // Insert the new element after the original in the DOM
        if (append) {
            $originalElement.after($newElement);
        }

        // Remove the last child of the original element if it is empty and 'inline'
        const childNodes = $originalElement.get().childNodes;
        const lastChild =  childNodes[childNodes.length-1];
        if (inspector.is(lastChild, 'inline')) {
            if (!lastChild.innerHTML.trim()) {
                lastChild.remove();
            }
        }

        // Initialize block type if applicable
        const blockType = inspector.getType($newElement);
        if (blockType) {
            //const block = new Block(this.app, { type: blockType, source: $newElement });
            const block = this.app.create('block.' + blockType, $newElement);
        }

        // Remove the original element if it's empty
        if (!$originalElement.html().trim()) {
            $originalElement.remove();
        }

        return $newElement;
    }
}

Redactor.ElementSplitter = ElementSplitter;
class Tool {
    constructor(app, name, obj, form) {
        this.app = app;
        this.dom = app.dom;
        this.page = app.page;
        this.loc = app.loc;
        this.uuid = app.uuid;
        this.scroll = app.scroll;
        this.config = app.config;

        // local
        this.name = name;
        this.setter = form.getSetter();
        this.form = form;
        this.obj = this._observe(obj);

        if (this.obj) {
            this._build();
        }
    }

    getType() {
        return this.obj.type;
    }

    getElement() {
        return this.$tool;
    }

    getInput() {
        return this.$input;
    }

    getValue() {
        return this.$input.val().trim();
    }

    setValue(value) {
        this.$input.val(value);
    }

    setFocus() {
        this.$input.focus();
    }

    trigger(value) {
        this.setValue(value);
        this._triggerApi();
    }

    // Private Methods

    _build() {
        this._buildTool();
        this._buildLabel();
        this._buildInputElement();
        if (this._buildInput) this._buildInput();
        this._applyProps();
        this._buildEvents();
    }

    _buildTool() {
        this.$tool = this.dom('<div>').addClass('rx-form-item');

        if (this.obj.hidden) this.$tool.hide();
        if (this.obj.auto) this.$tool.css('flex', 'auto');
    }

    _buildLabel() {
        if (this.obj.label && this.getDefaults().type !== 'checkbox') {
            this.$label = this.dom('<label>')
                .addClass('rx-form-label')
                .html(this.loc.parse(this.obj.label));

            if (this.obj.hint) {
                const $hint = this.dom('<span>')
                    .addClass('rx-form-hint')
                    .html(`(${this.loc.parse(this.obj.hint)})`);
                this.$label.append($hint);
            }

            this.$tool.append(this.$label);
        }
    }

    _buildInputElement() {
        this.$input = this.dom(`<${this.getDefaults().tag}>`)
            .addClass(`rx${this.getDefaults().classname}`)
            .attr({
                name: this.name,
                type: this.getDefaults().type,
                'data-type': this.obj.type,
            });

        this.$tool.append(this.$input);
    }

    _buildEvents() {
        const eventTypes = this._getEventTypes();
        if (eventTypes.length > 0) {
            this.$input.on(eventTypes, this._catchSetter.bind(this));
        }
    }

    _applyProps() {
        if (this.obj.placeholder) {
            this.$input.attr('placeholder', this.loc.parse(this.obj.placeholder));
        }
        if (this.obj.width) {
            this.$input.css('width', this.obj.width);
        }
        if (this.obj.classname) {
            this.$input.addClass(this.obj.classname);
        }
    }

    _getEventTypes() {
        const type = this.getDefaults().type;
        if (type === 'checkbox' || type === 'select') return 'change';
        if (type === 'number') return 'input blur change';
        return this.setter ? 'input blur' : '';
    }

    _observe(obj) {
        return obj.observer ? this.app.api(obj.observer, obj, this.name) : obj;
    }

    _catchSetter(e) {
        if (e.type === 'keydown' && e.which !== 13) return;
        e.preventDefault();
        this._triggerApi();
    }

    _triggerApi() {
        if (this.setter) {
            this.app.api(this.setter, this.form);
        }
    }
}
class ToolCheckbox extends Tool {
    getDefaults() {
        return {
            tag: 'input',
            type: 'checkbox',
            classname: '-form-checkbox',
        };
    }

    getValue() {
        return this.$input.val();
    }

    // Private Methods

    _buildInput() {
        this.$box = this.dom('<label>').addClass('rx-form-checkbox-label');
        this.$box.append(this.$input);

        if (this.obj.text) {
            const $span = this.dom('<span>').html(this.loc.parse(this.obj.text));
            this.$box.append($span);
        }

        this.$tool.append(this.$box);
    }
}

Redactor.ToolCheckbox = ToolCheckbox;
class ToolColor extends Tool {
    getDefaults() {
        return {
            tag: 'input',
            type: 'text',
            classname: '-form-input',
        };
    }

    setValue(value) {
        const normalized = value || '#ffffff';
        this.$input.val(value || '');
        this.$toggle.css('background-color', normalized);
    }

    // Private methods

    _buildInput() {
        this.$item = this.dom('<div class="rx-form-color-container">');
        this.$toggle = this.dom('<div class="rx-form-color-toggle">');

        this.$item.append(this.$input);
        this.$item.append(this.$toggle);

        this.$tool.append(this.$item);

        this.$input.on('keyup blur', this._changeColor.bind(this));
        this.$toggle.on('click', this._toggleColorpicker.bind(this));
    }

    _changeColor() {
        const value = this._getColorValue(this.$input.val());
        this.$toggle.css('background-color', value);
    }

    _setColor(value, instant) {
        if (!instant) {
            this.colorpicker.close();
        }

        value = this._getColorValue(value);
        this.trigger(value);
    }

    _getColorValue(value) {
        const utils = new Utils(this.app);
        return utils.normalizeColor(value);
    }

    _toggleColorpicker(e) {
        e.preventDefault();
        e.stopPropagation();

        if (this.colorpicker && this.colorpicker.isOpen()) {
            return this.colorpicker.close();
        }

        this.colorpicker = new ColorPicker(this.app, {
            $toggle: this.$toggle,
            colors: this.config.get('colors'),
            instant: true,
            style: { color: this.getValue() },
            method: function(color, instant) {
                this._setColor(color, instant);
            }.bind(this)
        });
    }
}

Redactor.ToolColor = ToolColor;
class ToolInput extends Tool {
    getDefaults() {
        return {
            tag: 'input',
            type: 'text',
            classname: '-form-input'
        };
    }
}

Redactor.ToolInput = ToolInput;
class ToolNumber extends Tool {
    getDefaults() {
        return {
            tag: 'input',
            type: 'number',
            classname: '-form-input',
        };
    }

    // Private Methods

    _buildInput() {
        this.$input.attr({ min: 0 }).css('max-width', '100px');
        this.$tool.append(this.$input);
    }
}

Redactor.ToolNumber = ToolNumber;
class ToolSelect extends Tool {
    getDefaults() {
        return {
            tag: 'select',
            classname: '-form-select',
        };
    }

    _buildInput() {
        for (const [value, label] of Object.entries(this.obj.options)) {
            const $option = this.dom('<option>')
                .val(value)
                .html(this.loc.parse(label));
            this.$input.append($option);
        }

        this.$tool.append(this.$input);
    }
}

Redactor.ToolSelect = ToolSelect;
class ToolTextarea extends Tool {
    getDefaults() {
        return {
            tag: 'textarea',
            classname: '-form-textarea',
        };
    }

    setFocus() {
        this.$input.focus();
        this.$input.get().setSelectionRange(0, 0);
        this.$input.scrollTop(0);
    }

    // Private Methods

    _buildInput() {
        if (this.obj.rows) {
            this.$input.attr('rows', this.obj.rows);
        }

        this.$input.attr('data-gramm_editor', false);
        this.$tool.append(this.$input);
    }
}

Redactor.ToolTextarea = ToolTextarea;
class ToolUpload extends Tool {
    getDefaults() {
        return {
            tag: 'input',
            type: 'hidden',
            classname: '-form-input',
        };
    }

    setValue(value) {
        value = (value) ? value : '';

        if (this.upload) {
            this.upload.setImage(value);
        }

        this.$input.val(value);
    }

    // Private methods

    _buildInput() {
        this.$tool.append(this.$input);
        this._buildUpload();
    }

    _buildUpload() {
        this.$upload = this.dom('<input>').attr('type', 'file');
        this.$tool.append(this.$upload);

        const trigger = this.obj.trigger ? { instance: this, method: 'trigger' } : {};
        this.upload = new Uploader(this.app, { element: this.$upload, params: this.obj.upload, trigger: trigger });
    }
}

Redactor.ToolUpload = ToolUpload;
class ToolButton extends Tool {
    getDefaults() {
        return {
            tag: 'button',
            type: 'button',
            classname: '-form-button'
        };
    }

    _buildInput() {
        this.$input.attr('data-role', this.obj.role);
        this.$input.attr('data-command', this.obj.command);
        this.$input.html(this.loc.parse(this.obj.text || this.obj.title));

        if (this.obj.role) {
            this.$input.addClass('rx-form-button-' + this.obj.role);
        }

        if (this.obj.push) {
            this.$tool.css('margin-left', 'auto');
        }

        if (this.obj.dismiss) {
            this.$input.on('click', (e) => {
                e.preventDefault();
                this.app.dropdown.restoreSelection();
                this.app.dropdown.close();
            });

        } else if (this.obj.command) {
            this.$input.on('click', (e) => {
                e.preventDefault();
                this.app.dropdown.restoreSelection();
                this.app.api(this.obj.command, this.form);
            });
        }

    }
}

Redactor.ToolButton = ToolButton;
class ContainerModule {
    constructor(app) {
        this.app = app;
    }

    init() {
        // Initialize utilities
        this.manager = new ContainerManager(this.app);
        this.focusManager = new ContainerFocus(this.app, this.manager);

        this.buildBSModal();
    }

    stop() {
        this.app.editor.destroy();
        this.manager.removeAllContainers();
    }

    get(name) {
        return this.manager.getContainer(name);
    }

    toggleFocus() {
        this.manager.toggleFocus();
    }

    setFocus() {
        this.focusManager.setFocus();
    }

    setBlur() {
        this.focusManager.setBlur();
    }

    hasFocus() {
        return this.focusManager.hasFocus();
    }

    isExternal(name) {
        return this.manager.getTarget(name);
    }

    buildBSModal() {
        this.config.set('bsmodal', !!this.manager.getContainer('main').closest('.modal-dialog').length);
    }
}
class ContainerFocus {
    constructor(app, manager) {
        this.app = app;
        this.manager = manager;

        // local
        this.blurClass = 'rx-in-blur';
        this.focusClass = 'rx-in-focus';
    }

    setFocus() {
        this.manager.getContainer('main').swapClass(this.blurClass, this.focusClass);
    }

    setBlur() {
        this.manager.getContainer('main').swapClass(this.focusClass, this.blurClass);
    }

    hasFocus() {
        return this.manager.getContainer('main').hasClass(this.focusClass);
    }
}
class ContainerManager {
    constructor(app) {
        this.app = app;
        this.uuid = app.uuid;
        this.dom = app.dom;
        this.config = app.config;
        this.element = app.element;
        this.elements = ['toolbox', 'statusbar'];

        // local
        this.$body = app.page.getBody();
        this.$container = null;
        this.containers = {};
        this.targets = {};

        // build
        this._initializeContainers();
    }

    createMainContainer() {
        this.$container = this.dom('<div>')
            .attr('rx-uuid', this.uuid)
            .addClass(`rx-container rx-container-${this.uuid}`)
            .addClass(this.config.is('nocontainer') ? '' : 'rx-main-container');

        if (this.config.is('structure')) {
            this.$container.addClass('rx-main-wym');
        }

        this.element.after(this.$container);
    }

    removeAllContainers() {
        Object.values(this.containers).forEach(container => container.remove());
        if (this.$container) {
            this.$container.remove();
        }
        this.containers = {};
        this.targets = {};
    }

    getContainer(name) {
        return name === 'main' ? this.$container : this.containers[name];
    }

    getTarget(name) {
        return this.targets[name];
    }

    toggleFocus() {
        if (!this.config.is('toolbar.sharedTarget') && !this.config.is('statusbar.sharedTarget')) return;

        this.elements.forEach(name => {
            const $containers = this.$body.find(`.rx-${name}-external`);
            const $current = this.$body.find(`.rx-${name}-external.rx-${name}-container-${this.uuid}`);

            $containers.hide();
            $current.show();
        });
    }

    // Private methods

    _initializeContainers() {
        this.createMainContainer();
        this._buildContainers(this.$container, this.config.get('containers.main'));

        this.elements.forEach(name => this._buildExternal(name));
    }

    _buildContainers(target, containers) {
        containers.forEach(name => {
            const $container = this._createContainer(name, target);
            this.containers[name] = $container;

            // Build nested containers
            this._buildNestedContainers(name, $container);
        });
    }

    _createContainer(name, target) {
        const externalTarget = this._getExternalTarget(name);
        if (externalTarget) {
            this.targets[name] = externalTarget;
            target = externalTarget;
        }

        const $container = this.dom('<div>')
            .addClass(`rx-${name}-container rx-${name}-container-${this.uuid}`);

        if (externalTarget) {
            $container.toggleClass(`rx-${name}-external`, this.getTarget(name));
        }

        this._getTargetElement(target).append($container);

        return $container;
    }

    _getExternalTarget(name) {
        if (name === 'toolbox') {
            return this.config.get('toolbar.target');
        }
        if (name === 'toolbar') {
            return false;
        }
        return this.config.get(`${name}.target`);
    }

    _getTargetElement(target) {
        return target ? this.dom(target) : this.$container;
    }

    _buildNestedContainers(name, target) {
        const nestedContainers = this.config.get(`containers.${name}`);
        if (nestedContainers) {
            this._buildContainers(target, nestedContainers);
        }
    }

    _buildExternal(name) {
        if (name === 'toolbox' && !this.config.is('toolbar.sharedTarget')) return;
        if (name === 'statusbar' && !this.config.is('statusbar.sharedTarget')) return;

        const $containers = this.$body.find(`.rx-${name}-external`);
        $containers.hide().first().show();
    }
}
class AutosaveModule {
    constructor(app) {
        this.app = app;
        this.config = app.config;
        this.intervalId = null;

        this._initAutosave();
    }

    send() {
        if (!this.config.is('autosave.url') || this.config.is('autosave.interval')) return;
        this._send();
    }

    // Private methods

    _initAutosave() {
        if (!this.config.is('autosave.url') || !this.config.is('autosave.interval')) return;

        const interval = this.config.get('autosave.interval');

        if (interval && typeof interval === 'number' && interval > 0) {
            this.intervalId = setInterval(() => this._send(), interval);
        }
    }

    _send() {
        const name = this._getName();
        const url = this.config.get('autosave.url');
        const method = this.config.get('autosave.method');
        const autosaveData = this.config.get('autosave.data');
        const data = this._buildData(name, autosaveData);

        this._ajaxRequest(method, url, data, name);
    }

    _getName() {
        const autosaveName = this.config.get('autosave.name');
        if (autosaveName) {
            return autosaveName;
        }

        let name = this.app.element.getName();
        return name ? name : `content${this.app.uuid}`;
    }

    _buildData(name, additionalData) {
        const utils = new Utils(this.app);
        let data = {};
        data[name] = this.app.element.getHtml();
        return utils.extendData(data, additionalData);
    }

    _ajaxRequest(method, url, data, name) {
        this.ajax.request(method, {
            url: url,
            data: data,
            before: xhr => this._beforeSend(xhr, name, data),
            success: response => this._complete(response, name, data)
        });
    }

    _beforeSend(xhr, name, data) {
        const event = this.app.broadcast('autosave.before.send', { xhr, name, data });
        return !event.isStopped();
    }

    _complete(response, name, data) {
        const event = response && response.error ? 'autosave.error' : 'autosave.send';
        this.app.broadcast(event, { name, data, response });
    }
}
/*jshint esversion: 6 */
class CodemirrorModule {
    constructor(app) {
        this.app = app;

        // local
        this.cm = false;
    }

    create(params) {
        if (!this._isCodemirrorAvailable()) return;

        const config = this._getCodemirrorConfig();
        const codemirrorInstance = this._getCodemirrorInstance();

        this.cm = codemirrorInstance.fromTextArea(this._getElement(params.el), config);

        this._setAdditionalOptions(params);

        return this.cm;
    }

    destroy() {
        if (this.cm) {
            this.cm.toTextArea();
            this.cm = false;
        }
    }

    val(html) {
        return this._isCodemirrorAvailable() && this.cm ? this.cm.getValue() : html;
    }

    // Private Methods

    _isCodemirrorAvailable() {
        return this.config.get('codemirror');
    }

    _getCodemirrorConfig() {
        const config = this.config.get('codemirror');
        return typeof config === 'object' ? config : {};
    }

    _getCodemirrorInstance() {
        return this.config.get('codemirrorSrc') || CodeMirror;
    }

    _getElement(el) {
        return this.dom(el).get();
    }

    _setAdditionalOptions(params) {
        if (params.height) {
            this.cm.setSize(null, params.height);
        }
        if (params.focus) {
            this.cm.focus();
        }
    }
}
class ConfigModule {
    constructor(app, options, plugin = false) {
        this.app = app;
        this.element = app.element;
        this.config = {};
        this._init(plugin, options);
    }

    dump() {
        return this.config;
    }

    is(name) {
        let value = this.get(name);
        return value !== undefined && value !== false && value !== null;
    }

    set(name, value) {
        name.split('.').reduce((o, p, i, parts) => o[p] = i === parts.length - 1 ? value : o[p] || {}, this.config);
    }

    get(name) {
        return name.split('.').reduce((p, c) => p?.[c], this.config);
    }

    extend(obj) {
        this.opts = Redactor.extend(true, {}, this.config, obj);
    }

    remove(name) {
        let segments = name.split('.');
        let last = segments.pop();
        let target = segments.reduce((o, k) => o[k] || {}, this.config);

        delete target[last];
    }

    // Private methods

    _init(plugin, options) {
        // Default settings
        const defaultConfig = plugin ? ('defaults' in plugin) ? plugin.defaults : {} : Redactor.opts;
        const defaultOptions = Redactor.extend(true, {}, defaultConfig);
        const editorSettings = Redactor.extend(true, defaultOptions, Redactor.settings);

        // lowercased keys from data attributes
        const elementData = this._parseDataAttributes();
        this._updateObject(editorSettings, elementData);

        // Merging configuration with parameters
        const config = Redactor.extend(true, {}, editorSettings, elementData, options);

        // Finalization of all options
        this.config = Redactor.extend(true, config, options);
        this._configureTranslations(this.config);
    }

    _configureTranslations(options) {
        const loc = options.localization || options.translations; // @deprecated 5.0: use localization only
        if (loc) {
            Redactor.addLang(loc);
        }
    }

    _updateObject(target, source) {
        Object.keys(target).forEach(key => {
            const lowerKey = key.toLowerCase();
            if (source.hasOwnProperty(lowerKey)) {
                if (typeof target[key] === 'object' && target[key] !== null && typeof source[lowerKey] === 'object') {
                    this._updateObject(target[key], source[lowerKey]);
                } else {
                    target[key] = source[lowerKey];
                }
            }
        });
    }

    _parseDataAttributes() {
        const element = this.element.get();
        const data = {};

        Array.from(element.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
                this._processAttribute(attr, data);
            }
        });

        return data;
    }

    _processAttribute(attr, data) {
        const keys = attr.name.slice(5).split('-');
        let current = data;

        keys.forEach((key, index) => {
            if (index === keys.length - 1) {
                current[key] = this._parseValue(attr.value);
            } else {
                current = this._getOrCreateNextLevel(current, key);
            }
        });
    }

    _parseValue(value) {
        try {
            return JSON.parse(value);
        } catch (error) {
            try {
                const correctedValue = value.replace(/(\w+)\s*:/g, '"$1":').replace(/:\s*([\w\[\]{]+)\s*/g, ': "$1"').replace(/'/g, '"');
                return JSON.parse(correctedValue);
            } catch (error) {
                return value;
            }
        }
    }

    _getOrCreateNextLevel(current, key) {
        if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
            current[key] = {};
        }
        return current[key];
    }
}
/*jshint esversion: 6 */
class HotkeysModule {
    constructor(app) {
        this.app = app;

        // local
        this.triggered = false;
    }

    init() {
        this._initializeHotkeysConfig();
        this.hotkeys = this.config.get('hotkeys');
        this.hotkeysKeys = this._getHotkeysMap();
        this.hotkeysShiftNums = this._getShiftedKeysMap();
    }

    add(keys, obj) {
        this.hotkeys[keys] = obj;
    }

    remove(key) {
        this.config.set('hotkeys', this._removeKeyFromObject(key, this.config.get('hotkeys')));
        this.config.set('hotkeysBase', this._removeKeyFromObject(key, this.config.get('hotkeysBase')));
    }

    popup(e, button) {
        const meta = this._getMetaKey();
        let items = {};

        // items
        let z = this._buildPopupItems(items, 0, this.config.get('hotkeysBase'), meta, 'base');
        this._buildPopupItems(items, z, this.config.get('hotkeys'), meta);

        // create
        this.app.dropdown.create('hotkeys', { items, passive: true });
        this.app.dropdown.open(e, button);
    }

    handle(e) {
        this.triggered = false;

        // disable browser's hot keys for bold and italic if shortcuts off
        if (this.hotkeys === false) {
            this._disableDefaultShortcuts(e);
            return true;
        }

        // build
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
            Object.entries(this.hotkeys).forEach(([key, item]) => {
                this._buildHotkeyHandler(e, key, item);
            });
        }

        return this.triggered;
    }

    // Private methods

    _disableDefaultShortcuts(e) {
        if ((e.ctrlKey || e.metaKey) && (e.which === 66 || e.which === 73)) {
            e.preventDefault();
        }
    }

    _initializeHotkeysConfig() {
        // Remove specified hotkeys
        if (this.config.is('hotkeysRemove')) {
            this.config.get('hotkeysRemove').forEach(key => this.remove(key));
        }

        // Add specified hotkeys
        if (this.config.is('hotkeysAdd')) {
            Object.entries(this.config.get('hotkeysAdd')).forEach(([key, val]) => {
                this.config.set('hotkeys.' + key, val);
            });
        }
    }

    _getHotkeysMap() {
        return {
            8: "backspace", 9: "tab", 10: "return", 13: "return", 16: "shift", 17: "ctrl", 18: "alt", 19: "pause",
            20: "capslock", 27: "esc", 32: "space", 33: "pageup", 34: "pagedown", 35: "end", 36: "home",
            37: "left", 38: "up", 39: "right", 40: "down", 45: "insert", 46: "del", 59: ";", 61: "=",
            96: "0", 97: "1", 98: "2", 99: "3", 100: "4", 101: "5", 102: "6", 103: "7",
            104: "8", 105: "9", 106: "*", 107: "+", 109: "-", 110: ".", 111: "/",
            112: "f1", 113: "f2", 114: "f3", 115: "f4", 116: "f5", 117: "f6", 118: "f7", 119: "f8",
            120: "f9", 121: "f10", 122: "f11", 123: "f12", 144: "numlock", 145: "scroll", 173: "-", 186: ";", 187: "=",
            188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\", 221: "]", 222: "'"
        };
    }

    _getShiftedKeysMap() {
        return {
            "`": "~", "1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^", "7": "&",
            "8": "*", "9": "(", "0": ")", "-": "_", "=": "+", ";": ":", "'": "\"", ",": "<",
            ".": ">", "/": "?", "\\": "|"
        };
    }

    _removeKeyFromObject(keys, obj) {
        return Object.keys(obj).reduce((result, key) => {
            if (key !== keys) result[key] = obj[key];
            return result;
        }, {});
    }

    _getMetaKey() {
        return /Mac|iPhone|iPod|iPad/i.test(navigator.platform) ? 'Cmd' : 'Ctrl';
    }

    _buildPopupItems(items, z, hotkeys, meta, type = 'custom') {
        Object.entries(hotkeys).forEach(([key, item]) => {
            const title = (type === 'base') ? item : item.title;
            const name = (type === 'base') ? key.replace('meta', meta) : item.name.replace('meta', meta);

            items[z++] = { title: title, classname: 'rx-dropdown-item', shortcut: this._formatKeyDisplay(name, meta) };
        });

        return z;
    }

    _formatKeyDisplay(name, meta) {
        return name.split('+').map(key => {
            const defaultKey = key.search(/&/) === -1 ? key.toUpperCase() : key;
            if (key === 'Cmd' || key === 'Ctrl') return `<span class="rx-hk-meta">${key}</span>`;
            if (key === 'alt') return `<span class="rx-hk-alt">Alt</span>`;
            if (key === 'shift') return `<span class="rx-hk-shift">Shift</span>`;
            return `<span>${defaultKey}</span>`;
        }).join('+');
    }

    _buildHotkeyHandler(e, str, obj) {
        str.split(',').forEach(key => {
            if (typeof key === 'string' && !Object.prototype.hasOwnProperty.call(obj, 'trigger')) {
                this._handleHotkey(e, key.trim(), obj);
            }
        })
    }

    _handleHotkey(e, keys, obj) {
        const cmdKeys = ["meta", "ctrl", "alt", "shift"];
        const special = this.hotkeysKeys[e.keyCode];
        const character = (e.which !== 91) ? String.fromCharCode(e.which).toLowerCase() : false;
        let modif = this._getModifiers(e, cmdKeys, special);

        const possible = this._buildPossibleKeys(modif, special, character);
        keys = keys.toLowerCase().split(" ");

        for (const key of keys) {
            if (possible[key]) {
                e.preventDefault();
                this.triggered = true;
                this.app.api(obj.command, obj.params, e, true);
                return;
            }
        }
    }

    _getModifiers(e, cmdKeys, special) {
        return cmdKeys.reduce((modif, key) => {
            if (e[key + 'Key'] && special !== key) {
                modif += key + '+';
            }
            return modif;
        }, e.keyCode === 93 ? 'meta+' : '');
    }

    _buildPossibleKeys(modif, special, character) {
        const possible = {};
        if (special) possible[modif + special] = true;
        if (character) {
            possible[modif + character] = true;
            possible[modif + this.hotkeysShiftNums[character]] = true;
            if (modif === 'shift+') {
                possible[this.hotkeysShiftNums[character]] = true;
            }
        }
        return possible;
    }
}
class LocalizationManager {
    constructor(app, language) {
        this.language = language;
        this.translations = Redactor.lang[this.language] || Redactor.lang.en;
    }

    dump() {
        return this.translations;
    }

    has(name) {
        return this.get(name) !== '';
    }

    set(obj) {
        Redactor.extend(true, Redactor.lang, obj);
        this._init();
    }

    get(name) {
        let value = this._fetchFromVars(name) || (this.language !== 'en' && this._fetchFromDefaultLang(name));
        if (value === false) return name;
        return typeof value === 'undefined' ? '' : value;
    }

    parse(str) {
        return typeof str !== 'string' ? str : this._replaceLanguageVariables(str);
    }

    // Private methods

    _fetchFromVars(name) {
        return this._getValue(name, this.translations);
    }

    _fetchFromDefaultLang(name) {
        return this._getValue(name, Redactor.lang.en);
    }

    _replaceLanguageVariables(str) {
        let matches = str.match(/## (.*?) ##/g);
        if (matches) {
            matches.forEach(match => {
                let key = match.replace(/## /g, '').replace(/ ##/g, '');
                str = str.replace(match, this.get(key));
            });
        }
        return str;
    }

    _getValue(name, translations) {
        return name.split('.').reduce((acc, part) => acc && acc[part], translations);
    }
}
/*jshint esversion: 6 */
class ObserverModule {
    constructor(app) {
        this.app = app;

        // local
        this.styles = {};
        this.observer = null;
        this.trigger = true;
    }

    build() {
        if (!window.MutationObserver) return;

        const editorElement = this.app.editor.getLayout().get();
        const observerOptions = {
            attributes: true,
            subtree: true,
            childList: true,
            characterData: true,
            characterDataOldValue: true
        };

        this.observer = this._createObserver(editorElement);
        this.observer.observe(editorElement, observerOptions);
    }

    stop() {
        if (this.observer) this.observer.disconnect();
        this.trigger = true;
    }

    setTrigger(value) {
        this.trigger = value;
    }

    addKeys(type, name, value) {
        this.config.set(`active.${type}.${name}`, value);
    }

    getKeys() {
        this.styles = {};
        return this._collectActiveKeys();
    }

    getStyles() {
        return this.styles;
    }

    observeUnset() {
        this._resetActiveStates();
    }

    observe() {
        if (!this._shouldObserveToolbars()) return;

        this.styles = {};
        let buttons = this._collectActiveKeys();

        this._resetActiveStates();
        if (buttons.length) {
            this.app.ui.setActiveKeys(['toolbar', 'extrabar', 'context'], buttons, this.styles);
        }
    }

    // Private methods

    _shouldObserveToolbars() {
        return this.config.is('toolbar') || this.config.is('extrabar') || this.app.context.isOpen();
    }

    _createObserver(editorElement) {
        return new MutationObserver(mutations => {
            this._handleMutation(mutations[mutations.length - 1], editorElement);
        });
    }

    _handleMutation(mutation, editorElement) {
        if (mutation.type === 'attributes' && mutation.target === editorElement) return;

        if (this.trigger) {
            this.app.broadcast('observer.change');
            this.app.editor.adjustHeight();
            this.app.placeholder.trigger();
            this.app.block.trigger(mutation);
            this.app.blocks.trigger(mutation);
            this.app.sync.trigger();
        }
    }

    _collectActiveKeys() {
        const instance = this.app.block.get();
        const selection = new TextRange(this.app);
        if (!instance) return [];
        //if (!instance || selection.getBlockControlled() !== instance.getBlock().get()) return [];

        const tags = this._collectObservedTags(instance);
        const types = this._collectInstanceTypes(instance);
        let buttons = this._getKeysForTags(tags, instance);

        let result = [...buttons, ...this._getKeysForTypes(instance, types), ...types];

        const activeRules = this.config.get('active.rules');
        if (activeRules) {
            Object.entries(activeRules).forEach(([key, func]) => {
                const value = func(instance.getBlock().get());
                if (value) {
                    result.push(key);
                }
                else {
                    const index = result.indexOf(key);
                    if (index !== -1) result.splice(index, 1)
                }
            });
        }


        return result;
    }

    _collectInstanceTypes(instance) {
        if (!instance) return [];

        const types = [];
        const parentTypes = ['table', 'layout', 'wrapper'];

        parentTypes.forEach(type => {
            if (instance.getClosest(type)) types.push(type);
        });

        if (instance.isType('todoitem')) types.push('todo');
        if (instance.isType('listitem')) {
            const parentList = instance.getParentTopInstance();
            if (parentList) types.push(parentList.getTag());
        }

        return types;
    }

    _collectObservedTags(instance) {
        const selection = new TextRange(this.app);
        let inlines = selection.is() ? selection.getNodes({ type: 'inline', selected: 'inside', link: true, buttons: true }) : [];
        if (!selection.is() && instance && instance.isType('image') && instance.getLinkElement()) {
            inlines = [instance.getLinkElement().get(0)];
        }

        let tags = instance ? [instance.getTag()] : [];
        if (inlines.length) {
            tags = [...tags, ...this._collectInlineTags(inlines)];
        }

        return tags;
    }

    _collectInlineTags(inlines) {
        const utils = new Utils(this.app);
        const inlineTags = [];

        inlines.forEach(inline => {
            const css = utils.cssToObject(inline.getAttribute('style'));
            if (css.color) this.styles.color = css.color;
            if (css.background) this.styles.background = css.background;
            inlineTags.push(inline.tagName.toLowerCase());
        });

        return inlineTags;
    }

    _getKeysForTags(tags, instance) {
        const inlineTags = this.config.get('tags.inline');
        const activeTags = this.config.get('active.tags');
        return tags.reduce((keys, tag) => {
            if (!instance.isEditable() && inlineTags.includes(tag)) {
                return keys;
            }

            const tagKeys = activeTags[tag];
            return tagKeys ? keys.concat(tagKeys) : keys;
        }, []);
    }

    _getKeysForTypes(instance, types) {
        if (!instance) return [];

        const activeBlocks = this.config.get('active.blocks');
        const type = instance.getType();
        const blockKeys = activeBlocks[type] || [];

        return [...blockKeys, ...types];
    }

    _resetActiveStates() {
        this.app.toolbar.unsetActive();
        this.app.extrabar.unsetActive();
        this.app.context.unsetActive();
    }
}
class PageModule {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
        this.$win = this.dom(window);
        this.$doc = this.dom(document);
        this.$body = this.dom('body');
    }

    getWin() {
        return this._isIframeMode() ? this.getFrameWin() : this.$win;
    }

    getWinNode() {
        return this._isIframeMode() ? this.getFrameWinNode() : this.$win.get();
    }

    getDoc(frame = true) {
        return this._isIframeMode() && frame ? this.getFrameDoc() : this.$doc;
    }

    getDocNode() {
        return this._isIframeMode() ? this.getFrameDocNode() : this.$doc.get();
    }

    getBody() {
        return this.$body;
    }

    getFrameBody() {
        return this._isIframeMode() ? this.getFrameDoc().find('body') : this.$body;
    }

    getFrameHead() {
        return this.getFrameDoc().find('head');
    }

    getFrameDoc() {
        return this.dom(this.getFrameDocNode());
    }

    getFrameDocNode() {
        const editor = this._getEditorNode();
        return editor && editor.contentWindow ? editor.contentWindow.document : null;
    }

    getFrameWin() {
        return this.dom(this.getFrameWinNode());
    }

    getFrameWinNode() {
        const editor = this._getEditorNode();
        return editor && editor.contentWindow ? editor.contentWindow : null;
    }

    // Private methods

    _isIframeMode() {
        return this.app.isMode('iframe');
    }

    _getEditorNode() {
        return this.app.getEditor()?.get();
    }
}
/*jshint esversion: 6 */
class PlaceholderModule {
    constructor(app) {
        this.app = app;

        // local
        this.placeholderClass = 'rx-placeholder';
        this.observerTimer = null;
    }

    build() {
        const configPlaceholder = this.config.get('placeholder');
        const elementPlaceholder = this.app.element.getPlaceholder();
        const placeholder = elementPlaceholder || configPlaceholder;

        if (placeholder) {
            this._setEditorPlaceholder(placeholder);
        }
    }

    handleClick(e) {
        if (this._isPlaceholderClicked(e)) {
            e.preventDefault();
            e.stopPropagation();
            this.app.editor.setFocus('start', false);
        }
    }

    trigger() {
        this.$editor = this.app.editor.getLayout();
        if (this.app.editor.isEmpty()) {
            this.show();
        } else {
            this.hide();
        }
    }

    set(content) {
        this._setEditorPlaceholder(content);
    }

    toggle() {
        clearTimeout(this.observerTimer);
        this.observerTimer = setTimeout(() => this.trigger(), 10);
    }

    show() {
        this.$editor.addClass(this.placeholderClass);
    }

    hide() {
        this.$editor.removeClass(this.placeholderClass);
    }

    // Private methods

    _isPlaceholderClicked(e) {
        return this.dom(e.target).hasClass(this.placeholderClass);
    }

    _setEditorPlaceholder(content) {
        this.app.editor.getLayout().attr('placeholder', content);
    }
}
/*jshint esversion: 6 */
class ProgressModule {
    constructor(app) {
        this.app = app;

        // local
        this.$progress = null;
        this.$progressBar = null;
    }

    stop() {
        this.hide();
    }

    show($target) {
        this.hide();
        this._createProgressElements();

        const target = $target && typeof $target !== 'boolean' ? $target : this.app.page.getBody();
        target.append(this.$progress);
    }

    hide() {
        if (this.$progress) {
            this.$progress.remove();
            this.$progress = null;
            this.$progressBar = null;
        }
    }

    // Private Methods

    _createProgressElements() {
        this.$progress = this.dom('<div>')
            .addClass('rx-editor-progress')
            .attr('id', 'rx-progress');

        this.$progressBar = this.dom('<span>');
        this.$progress.append(this.$progressBar);
    }
}
/*jshint esversion: 6 */
class ScrollModule {
    constructor(app) {
        this.app = app;
        this.config = app.config;
        this.dom = app.dom;

        // local
        this.scrolltop = null;
        this.reserved = null;
    }

    save() {
        this.scrolltop = this.getTarget().scrollTop();
    }

    restore() {
        if (this.scrolltop !== null) {
            this.getTarget().scrollTop(this.scrolltop);
            this.scrolltop = null;
        }
    }

    getScrollTop() {
        return this.getTarget().scrollTop();
    }

    isTarget() {
        return this.config.is('scrollTarget');
    }

    resetTarget() {
        if (this.reserved) {
            this.config.set('scrollTarget', this.reserved === window ? false : this.reserved);
            this.reserved = null;
        }
    }

    setTarget(el) {
        this.reserved = this.config.get('scrollTarget') || window;
        this.config.set('scrollTarget', el);
    }

    getTarget() {
        return this.dom(this.config.get('scrollTarget') || window);
    }

    getVisibility(tolerance = 0) {
        const element = this.app.container.get('main').get();
        const $target = this.getTarget();
        const targetElement = $target.get();
        const elementRect = element.getBoundingClientRect();

        let scrollTop, targetHeight, offsetTop;
        if (targetElement === window) {
            scrollTop = window.scrollY;
            targetHeight = window.innerHeight;
            offsetTop = 0;
        } else {
            scrollTop = targetElement.scrollTop;
            targetHeight = targetElement.clientHeight;
            offsetTop = targetElement.getBoundingClientRect().top;
        }

        const elementOffsetTop = this._getOffsetTop(element, targetElement);
        const elementBottom = elementOffsetTop + elementRect.height;

        const viewportTop = scrollTop;
        const viewportBottom = scrollTop + targetHeight;

        return {
            isTopVisible: elementOffsetTop >= viewportTop && elementOffsetTop <= viewportBottom - tolerance,
            isBottomVisible: elementBottom >= viewportTop + tolerance && elementBottom <= viewportBottom,
            isTopEdge: targetHeight <= elementRect.top + tolerance,
            isBottomEdge: targetHeight <= elementRect.bottom,
            top: elementOffsetTop + scrollTop,
            bottom: targetHeight - elementOffsetTop + scrollTop
        };
    }

    _getOffsetTop(element, container) {
        let offsetTop = 0;
        let current = element;

        while (current && current !== container) {
            offsetTop += current.offsetTop;
            current = current.offsetParent;
        }

        return offsetTop;
    }

    scrollTo($el, tolerance = 60) {
        $el = this.dom($el);
        if (!this._isScrollVisible($el)) {
            const value = $el.offset().top - tolerance;
            const $target = this.getTarget();
            $target.scrollTop(value);
            setTimeout(() => $target.scrollTop(value), 1);
        }
    }

    // Private methods

    _isScrollVisible(el, $target = null) {
        const $el = this.dom(el);
        const elemTop = $el.offset().top;
        const $scrollTarget = $target || this.getTarget();
        const docViewBottom = $scrollTarget.scrollTop() + $scrollTarget.height();
        return elemTop <= docViewBottom;
    }
}
/*jshint esversion: 6 */
class SourceModule {
    constructor(app) {
        this.app = app;

        // local
        this.eventname = 'rx-source-events';
    }

    init() {
        this.$source = this.dom('<textarea>')
            .addClass('rx-source')
            .attr('data-gramm_editor', false);

        this.app.container.get('source').append(this.$source);
    }

    setContent(content) {
        this.$source.val(content);
    }

    getContent() {
        let html = this.$source.val();
        return this.app.codemirror.val(html);
    }

    getElement() {
        return this.$source;
    }

    getSource() {
        return this.$source;
    }

    update(html) {
        this.app.editor.setSource(html);
    }

    is() {
        const $cont = this.app.container.get('source');
        return $cont && $cont.length && $cont.css('display') !== 'none';
    }

    toggle() {
        this.is() ? this.close() : this.open();
    }

    open() {
        const editor = this.app.container.get('editor');
        const source = this.app.container.get('source');

        this.app.broadcast('source.before.open');

        let html = this.app.editor.getContent(true);
        const editorHeight = this._adjustHeight(editor);

        this._prepareSource(html);
        this._toggleView(editor, source, true);
        this._initializeCodemirror(editorHeight);

        this._setUIState(true);
        this._setHeight();
        this.app.broadcast('source.open');
    }

    close() {
        if (!this.is()) return;

        this.app.broadcast('source.before.close');

        const editor = this.app.container.get('editor');
        const source = this.app.container.get('source');
        const html = this.getContent();

        this.app.codemirror.destroy();

        this._toggleView(editor, source, false);
        this.app.editor.setContent({ html, caret: 'start' });

        this._setUIState(false);
        this.app.broadcast('source.close');
    }

    // Private methods

    _adjustHeight(editor) {
        const minHeight = this._getMinHeight();
        const height = Math.max(this.$source.get().scrollHeight, minHeight);

        this.$source.css('height', 'auto').css('height', `${height}px`);
        return Math.max(editor.height(), minHeight);
    }

    _getMinHeight() {
        return parseInt(this.config.get('minHeight'));
    }

    _prepareSource(html) {
        this.$source.val(html)
            .on(`focus.${this.eventname}`, this._handleFocus.bind(this))
            .on(`input.${this.eventname}`, this._handleChanges.bind(this))
            .on(`keydown.${this.eventname}`, this.app.event.handleTextareaTab.bind(this));

        this.app.blocks.unset();
        this.app.block.unset();
        this.app.editor.deselectAll();
    }

    _toggleView(editor, source, showSource) {
        if (showSource) {
            editor.hide();
            source.show();
        } else {
            source.hide();
            editor.show();
        }
    }

    _initializeCodemirror(editorHeight) {
        const cm = this.app.codemirror.create({ el: this.$source, height: editorHeight, focus: true });
        if (cm) {
            cm.setSize("100%", "100%");
            cm.on('change', this._handleChanges.bind(this));
            cm.on('focus', this._handleFocus.bind(this));
        }
    }

    _setUIState(isOpen) {
        if (isOpen) {
            this.app.ui.close();
            this.app.ui.disable();
            this.app.toolbar.enableSticky();
            this.app.toolbar.setToggled('html');
            this.app.extrabar.setToggled('html');
        } else {
            this.app.ui.enable();
            this.app.toolbar.unsetToggled('html');
            this.app.extrabar.unsetToggled('html');
        }
    }

    _handleFocus() {
        this.app.editor.setFocus();
    }

    _handleChanges(e) {
        const html = this.getContent();
        this.update(html);

        this._setHeight();
        this.app.broadcast('source.change', { e: e });
    }

    _setHeight() {
        this.$source.get().style.height = 'auto';
        this.$source.get().style.height = `${this.$source.get().scrollHeight}px`;
    }
}
/*jshint esversion: 6 */
class StateModule {
    constructor(app) {
        this.app = app;

        // local
        this.storage = false;
        this.undoStorage = [];
        this.redoStorage = [];
    }

    load() {
        this.clear();
        if (this.app.isMode('iframe')) {
            this.app.on('editor.ready', this.loadInitialState.bind(this));
        } else {
            this.loadInitialState();
        }
    }

    stop() {
        this.clear();
    }

    get() {
        return this.undoStorage;
    }

    clear() {
        this.storage = false;
        this.undoStorage = [];
        this.redoStorage = [];
    }

    trigger() {
        const state = this._createState();
        if (state) {
            this._addStateToUndo(state);
        }
    }

    add(e) {
        if (this._isSpecialKeyEvent(e) || !this.app.observer.trigger) {
            return;
        }

        const state = this._createState();
        if (state) {
            this._updateCurrentState(state);
        }
    }

    listen(e) {
        if (this._isUndo(e)) {
            e.preventDefault();
            this.undo();
            return true;
        }
        if (this._isRedo(e)) {
            e.preventDefault();
            this.redo();
            return true;
        }
        return false;
    }

    undo() {
        if (!this._hasUndo()) return;

        const state = this._getPreviousUndoState();
        if (state) {
            if (this._isToolMode()) {
                this.undoStorage.push(state);
                return;
            }

            this._saveRedoState();
            this._rebuildEditor(state, 'undo');
        }
    }

    redo() {
        if (!this._hasRedo()) return;

        const state = this.redoStorage.pop();
        if (state) {
            if (this._isToolMode()) {
                this.redoStorage.push(state);
                return;
            }

            this._addStateToUndo(state);
            this._rebuildEditor(state, 'redo');
            this.undoStorage.splice(this.undoStorage.length-1, 1);
        }
    }

    loadInitialState() {
        const state = this._createState();
        if (state) {
            this.undoStorage.push(state);
            this.storage = state;
        }
    }

    // Private methods

    _isSpecialKeyEvent(e) {
        return e && (e.ctrlKey || e.metaKey || this._isUndo(e) || this._isRedo(e));
    }

    _updateCurrentState(state) {
        const pos = this.undoStorage.length-1;
        if (pos >= 0) {
            this.undoStorage[pos] = state;
        }
    }

    _addStateToUndo(state) {
        const last = this.undoStorage[this.undoStorage.length-1];
        if (typeof last === 'undefined' || last.html !== state.html) {
            this.undoStorage.push({ html: state.html, offset: state.offset, synced: true });
            this._trimUndoStorage();
        }
    }

    _trimUndoStorage() {
        const limit = this.config.get('state.limit');
        if (this.undoStorage.length > limit) {
            this.undoStorage = this.undoStorage.slice(-limit);
        }
    }

    _getPreviousUndoState() {
        const pos = this.undoStorage.length - 2;
        if (pos !== -1) {
            this.undoStorage.splice(pos + 1, 1);
        }
        return this.undoStorage[pos];
    }

    _saveRedoState() {
        const state = this._createState();
        if (state) {
            const limit = this.config.get('state.limit');
            this.redoStorage.push(state);
            this.redoStorage = this.redoStorage.slice(0, limit);
        }
    }

    _parseHtml(html) {
        const parser = new Parser(this.app);
        return parser.parse(html, { type: 'html', nodes: true });
    }

    _restoreEditorContent($parsed, state) {
        this.app.editor.getLayout().html($parsed);
        this.app.editor.build();

        if (this.app.has('email')) {
            this.app.email._build(true);
        }
    }

    _restoreEmailOptions(state) {
        if (this.app.has('email')) {
            this.app.email.reset();
            this.app.email.setOptions(state.emailOptions);
        }
    }

    _restoreFocus(state) {
        const offset = new Offset(this.app);
        const $el = this.app.editor.getLayout().find('.rx-block-state');
        if ($el.length !== 0) {
            setTimeout(() => {
                this.app.block.set($el);
                offset.set(state.offset, $el);
                $el.removeClass('rx-block-state');
            }, 1);
        } else if (state.offset === false) {
            this.app.editor.setFocus('start', false);
        } else {
            offset.set(state.offset);
            this.app.event.setMultipleBlocks();
        }
    }

    _rebuildEditor(state, type) {
        this.app.ui.close();

        const $parsed = this._parseHtml(state.html);
        this._restoreEmailOptions(state);
        this._restoreEditorContent($parsed, state);
        this._restoreFocus(state);
        setTimeout(() => {
            this.app.observer.observe();
            this.app.broadcast(`state.${type}`, state);
        }, 2);
    }

    _isUndo(e) {
        return (e.ctrlKey || e.metaKey) && e.which === 90 && !e.shiftKey && !e.altKey;
    }

    _isRedo(e) {
        return (e.ctrlKey || e.metaKey) && ((e.which === 90 && e.shiftKey) || (e.which === 89));
    }

    _hasUndo() {
        return this.undoStorage.length !== 0;
    }

    _hasRedo() {
        return this.redoStorage.length !== 0;
    }

    _getEditorContent() {
        if (this.app.has('email')) {
            return this.app.email.getContent();
        }

        if (this.app.editor.getContentType() === 'json') {
            const blocks = this.app.blocks.get({ instances: true });
            blocks.forEach(block => {
                if (block) {
                    const attrs = block.getAttrs();
                    if (attrs) {
                        block.getBlock().attr('data-rx-attrs', JSON.stringify(attrs));
                    }
                }
            });
        }

        return this.app.editor.getLayout().html();
    }

    _getEmailOptions() {
        if (this.app.has('email')) {
            return this.config.get('email');
        }
        return null;
    }

    _getOffset() {
        const offset = new Offset(this.app);
        const instance = this.app.block.get();
        const el = instance && instance.isEditable() ? instance.getBlock() : false;

        return this.app.blocks.is() ? offset.get() : offset.get(el);
    }

    _createState() {
        if (this._isToolMode()) return false;

        const offsetObj = this._getOffset();
        let html = this._getEditorContent();

        if (!this.app.blocks.is()) {
            const utils = new Utils(this.app);
            html = utils.wrap(html, function($w) {
                $w.find('.rx-block-focus').addClass('rx-block-state');
            }.bind(this));
        }

        const unparser = new Unparser(this.app);
        const unparsed = unparser.unparse(html, { state: true });
        return { html: unparsed, offset: offsetObj, emailOptions: this._getEmailOptions() };
    }

    _isToolMode() {
        return this.app.editor.getLayout().find('.rx-in-tool').length > 0;
    }
}
/*jshint esversion: 6 */
class SyncModule {
    constructor(app) {
        this.app = app;

        // local
        this.syncedHtml = '';
        this.typingTimer = null;
    }

    build() {
        this.syncedHtml = this.app.element.getHtml();
    }

    destroy() {
        this._clearTypingTimer();
    }

    trigger() {
        if (!this.config.is('sync')) return;

        this._clearTypingTimer();
        this.typingTimer = setTimeout(() => this.update(), this.config.get('syncDelay'));
    }

    update() {
        const currentHtml = this._getHtml();
        if (this._needsSync(currentHtml)) {
            this._sync(currentHtml);
        }
    }

    invoke() {
        let currentHtml = this._getHtml();
        this.syncedHtml = currentHtml;
        this._sync(currentHtml);
    }


    // Private methods

    _needsSync(html) {
        if (this.syncedHtml !== html) {
            this.syncedHtml = html;
            return true;
        }
        return false;
    }

    _clearTypingTimer() {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }
    }

    _getHtml() {
        const unparser = new Unparser(this.app);
        const html = this.app.editor.getHtml();
        return unparser.unparse(html);
    }

    _sync(html) {
        const event = this.app.broadcast('editor.before.change', { html: html });
        if (event.isStopped()) return;

        const updatedHtml = event.get('html');

        this.app.editor.setOutput(updatedHtml);
        this.app.editor.setSource(updatedHtml);
        this.app.autosave.send();
        this.app.state.trigger();
        this.app.broadcast('editor.change', event);
    }
}
class InlineModule {
    constructor(app) {
        this.app = app;
        this.offset = false;
        this.count = 0;
    }

    init() {
        this.popupManager = new InlinePopupManager(this.app);
    }

    popup(e, button) {
        this.popupManager.popup(e, button);
    }

    set(params, instant, skipTool) {
        if (skipTool !== true && this.app.block.isTool()) return;

        let $nodes = this.dom([]);
        const selection = new TextRange(this.app);
        const offset = new Offset(this.app);

        // close
        if (instant !== true) {
            this.app.dropdown.close();
        }

        // params
        this.params = params || {};
        this.instant = instant;
        this.offset = offset.get();

        // normalize style
        if (this.params.style) {
            let obj = {};
            for (let [key, val] of Object.entries(this.params.style)) {
                let str = key.replace(/([A-Z])/g, " $1");
                str = str.split(' ').join('-').toLowerCase();
                obj[str] = val;
            }

            this.params.style = obj;
        }

        if (!selection.getRange()) return;

        this.params.tag = this._replaceTags();
        if (selection.isCollapsed()) {
            $nodes = this._formatCollapsed();
        }
        else {
            $nodes = this._formatUncollapsed();
        }

        this.offset = offset.get();
        this.app.context.updatePosition();
        this.app.broadcast('inline.set', { $nodes: $nodes });
        this.app.sync.trigger();
        this.app.observer.observe();

        return $nodes;
    }

    remove(params) {
        const selection = new TextRange(this.app);
        const cache = new CleanerCache(this.app);
        let inlines = selection.getNodes({ type: 'inline', link: true });
        let inline = selection.getInlineTop();

        // make split
        if (selection.isCollapsed() && inline) {
            const caret = new Caret(this.app);
            let tag = inline.tagName.toLowerCase(),
                $target = this._insertSplit(inline, tag);

            caret.set($target, 'before');
            return;
        }

        // remove
        this.app.editor.save();
        if (params.style) {
            let arr = (Array.isArray(params.style)) ? params.style : [params.style];
            for (let i = 0; i < inlines.length; i++) {
                let $el = this.dom(inlines[i]);
                let tag = inlines[i].tagName.toLowerCase();
                $el.removeAttr('data-rx-style-cache');
                for (let z = 0; z < arr.length; z++) {
                    $el.css(arr[z], '');
                }

                if ($el.attr('style') === '') {
                    $el.removeAttr('style');
                }
                cache.cacheElementStyle($el);
                if (tag === 'span' && inlines[i].attributes.length === 0) {
                    $el.unwrap();
                }
            }
        }
        else if (params.classname) {
            for (let i = 0; i < inlines.length; i++) {
                let $el = this.dom(inlines[i]);
                let tag = inlines[i].tagName.toLowerCase();
                $el.removeClass(params.classname);
                if ($el.attr('class') === '') {
                    $el.removeAttr('class');
                }
                if (tag === 'span' && inlines[i].attributes.length === 0) {
                    $el.unwrap();
                }
            }
        }
        this.app.editor.restore();
        this.app.observer.observe();
    }

    removeFormat() {
        this.app.dropdown.close();

        // instance
        let instance = this.app.block.get();
        const selection = new TextRange(this.app);
        let $node;

        if (!instance) return;

        // save selection
        let $block = instance.getBlock();
        this.app.editor.save($block);

        let nodes = selection.getNodes({ type: 'inline', link: true });
        for (let i = 0; i < nodes.length; i++) {
            $node = this.dom(nodes[i]);

            if (nodes[i].tagName === 'A') {
                $node.removeAttr('style data-rx-style-cache');
                continue;
            }

            if (!$node.attr('data-rx-type')) {
                $node.unwrap();
            }
        }

        // restore selection
        this.app.editor.restore();
        this.app.observer.observe();
    }

    restoreOffset() {
        if (this.offset) {
            const offset = new Offset(this.app);
            offset.set(this.offset);
        }
    }

    _formatCollapsed() {
        let node;
        const selection = new TextRange(this.app);
        const caret = new Caret(this.app);
        const utils = new Utils(this.app);
        const offset = new Offset(this.app);
        const inspector = new ElementInspector(this.app);
        let inline = selection.getInline();
        let inlineTop = selection.getInlineTop(false, this.params.tag);
        let inlines = inspector.getInlines(inline);
        let $inline = this.dom(inline);
        let tags = this._getTags();
        let hasSameTag = this._isSameTag(inline, tags);
        let hasSameTopTag = this._isSameTag(inlineTop, tags);
        let point = (this.params && this.params.caret) ? this.params.caret : false;

        // save
        this.app.editor.save();

        // 1) not inline
        if (!inline) {
            node = this._insertInline(this.params.tag, point);
            node = this._setParams(node);
            this.app.editor.save(node, 'inline');
        }
        // 2) inline is empty
        else if (inline && utils.isEmptyHtml(inline.innerHTML)) {
            if (hasSameTag) { // 2.1) has same tag
                if (this._isParams()) { // 2.2.1) params
                    if (this._hasAllSameParams(inline)) { // all the same
                        caret.set(inline, (point) ? point : 'after');
                        $inline.remove();
                    } else if (this._hasSameClassname(inline)) {
                        if (!this.instant) this.app.editor.restore();
                        node = this._setStyle(inline);
                    } else if (this._hasSameStyle(inline)) {
                        if (!this.instant) this.app.editor.restore();
                        node = this._setClassname(inline);
                    } else { // not the same
                        if (!this.instant) this.app.editor.restore();
                        node = this._setParams(inline);
                    }
                } else { // 2.2.2) no params
                    caret.set(inline, (point) ? point : 'after');
                    $inline.remove();
                }
            } else if (this._hasCommonTags(inlines, tags)) {
                let index = this._findMatchingIndex(inlines, tags);
                const removedElement = inlines.splice(index, 1)[0];
                this.dom(removedElement).unwrap();
                inlines.reverse();
                caret.set(inlines[inlines.length - 1], 'start');
            } else { // 2.2) has a different tag
                node = this._insertInline(this.params.tag, point);
                node = this._setParams(node);
            }
        }
        // 3) inline isn't empty
        else if (inline) {
            if (hasSameTag) { // 3.1) has same tag
                if (this._isParams()) { // 3.1.1) params
                    if (this._hasAllSameParams(inline)) { // all the same
                        this._makeSplit(inline, point);
                    } else if (this._hasSameClassname(inline)) {
                        node = this._insertInline(this.params.tag, point);
                        node = this._setStyle(node);
                    } else if (this._hasSameStyle(inline)) {
                        node = this._insertInline(this.params.tag, point);
                        node = this._setClassname(node);
                    } else { // not the same
                        node = this._insertInline(this.params.tag, point);
                        node = this._setParams(node);
                    }
                } else { // 3.1.2) no params
                    this._makeSplit(inline, point);
                }
            } else if (hasSameTopTag) {
                if (this._isParams()) { // 3.1.1) params
                    if (this._hasAllSameParams(inlineTop)) { // all the same
                        this._makeSplit(inlineTop, point, inline);
                    }  else if (this._hasSameClassname(inlineTop)) {
                        node = this._insertInline(this.params.tag, point);
                        node = this._setStyle(node);
                    }  else if (this._hasSameStyle(inlineTop)) {
                        node = this._insertInline(this.params.tag, point);
                        node = this._setClassname(node);
                    } else { // not the same
                        node = this._insertInline(this.params.tag, point);
                        node = this._setParams(node);
                    }
                } else { // 3.1.2) no params
                    this._makeSplit(inlineTop, point, inline);
                }
            } else { // 3.2) has a different tag
                node = this._insertInline(this.params.tag, point);
                node = this._setParams(node);
            }
        }

        this.app.editor.resetSaved();
        return this.dom(node);
    }

    _formatUncollapsed() {
        const selection = new TextRange(this.app);
        const caret = new Caret(this.app);
        let $nodes = false;
        let selectedAll = this.app.editor.isSelectAll();
        let $blocks = this.dom(selection.getNodes({ type: 'block', partial: true }));
        let inlines = selection.getNodes({ type: 'inline' });

        // convert tags
        this.app.editor.save();
        this._convertTags($blocks, inlines);
        this.app.editor.restore();

        // convert strike
        this.app.editor.save();
        this._convertToStrike(inlines);
        this.app.editor.restore();

        // apply strike
        this.app.page.getDocNode().execCommand('strikethrough');

        // revert strike
        this.app.editor.save();
        $nodes = this._revertToInlines($blocks);
        this.app.editor.restore();

        // clean up
        this._clearEmptyStyle();

        // apply params
        this.app.editor.save();
        $nodes.each(this._applyParams.bind(this));
        this.app.editor.restore();

        // normalize
        $blocks.each(function($node) {
            $node.get().normalize();
        });

        // revert tags
        this.app.editor.save();
        this._revertTags($blocks);
        this.app.editor.restore();

        // caret
        if (this.params.caret) {
            let $last = $nodes.last();
            caret.set($last, this.params.caret);
        }

        // all selected
        if (selectedAll) {
            this.app.editor.selectAll();
        }

        return $nodes;
    }

    // params
    _isParams() {
        return (this.params.style || this.params.classname);
    }
    _applyParams($node) {
        let tag = $node.tag();
        let tags = this._getTags();
        let $parent = $node.parent();
        let hasSameTag = ($parent.length !== 0) ? this._isSameTag($parent.get(), tags) : false;

        if (hasSameTag && $parent.text() === $node.text()) {
            this._applyParamsToNode($parent, tag);
            return;
        }

        this._applyParamsToNode($node, tag);
    }
    _applyParamsToNode($node, tag) {
        $node.removeAttr('data-rx-style-cache');
        if ($node.attr('class') === '') $node.removeAttr('class');
        if ($node.get().attributes.length === 0) {
            if (this._isParams() && this.params.tag === 'span') {
                this._setParams($node);
                this._clearSpanInside($node);
            }
            else if (tag === 'span') {
                $node.unwrap();
            }
        }
        else if (this._isParams()) {
            this._setParams($node);
            this._clearSpanInside($node);
        }
    }
    _setParams(el) {
        el = this._setClassname(el);
        el = this._setStyle(el);

        return el;
    }
    _setClassname(el) {
        let $node = this.dom(el);

        if (this.params.classname) {
            // remove group classes
            if (this.params.group) {
                let optName = 'inlineGroups.' + this.params.group;
                let classes = (this.config.is(optName)) ? this.config.get(optName) : false;
                if (classes) {
                    $node.removeClass(classes.join(' '));
                }
            }
            // remove class
            else {
                $node.removeAttr('class');
            }

            // add class
            $node.addClass(this.params.classname);
        }

        return $node.get();
    }
    _setStyle(el) {
        const $node = this.dom(el);
        const cache = new CleanerCache(this.app);

        if (this.params.style) {
            $node.css(this.params.style);
            cache.cacheElementStyle($node);
        }

        return $node.get();
    }
    _hasAllSameParams(el) {
        return (this._hasSameClassname(el) && this._hasSameStyle(el));
    }
    _hasSameClassname(el) {
        let $el = this.dom(el);

        if (!$el.attr('class')) {
            return false;
        }
        else if (this.params.classname) {
            return $el.hasClass(this.params.classname);
        }

        return true;
    }
    _hasSameStyle(el) {
        const $el = this.dom(el);
        const inspector = new ElementInspector(this.app);

        if (this.params.style) {
            return inspector.compareStyle($el, this.params.style);
        }

        return true;
    }
    _hasCommonTags(inlines, tags) {
        return tags.some(tagName =>
            inlines.some(element => element.tagName.toLowerCase() === tagName)
        );
    }
    _findMatchingIndex(inlines, tags) {
        return inlines.findIndex(element =>
            tags.some(tagName => element.tagName.toLowerCase() === tagName)
        );
    }

    // insert
    _makeSplit(inline, point, duplicateTop) {
        const caret = new Caret(this.app);
        const inspector = new ElementInspector(this.app);
        let isEnd = caret.is(inline, 'end');
        let target = inline;

        if (duplicateTop) {
            if (isEnd) {
                target = inline;
            } else {
                target = this._insertSplit(inline);
            }

            let inlinesAll = inspector.getInlines(duplicateTop, this.params.tag);
            let clone = inlinesAll[0].cloneNode();
            clone.innerHTML = '';
            let newNode = clone;
            let last = newNode;
            let max = inlinesAll.length - 1;
            inlinesAll.reverse();
            for (let i = 0; i < max; i++) {
                clone = inlinesAll[i].cloneNode();
                clone.innerHTML = '';
                this.dom(newNode).append(clone);
                last = clone;
            }

            let action =  isEnd ? 'after' : 'before';
            this.dom(target)[action](newNode);
            caret.set(last, 'start');
        } else {
            if (isEnd) {
                point = 'after';
            } else {
                target = this._insertSplit(inline);
            }

            caret.set(target, (point) ? point : 'before');
        }
    }
    _insertSplit(inline, tag) {
        const utils = new Utils(this.app);
        let $inline = this.dom(inline);
        let extractedContent = utils.extractHtmlFromCaret(inline);
        let $secondPart = this.dom('<' + (tag || this.params.tag) + ' />');
        let div = document.createElement("div");

        div.appendChild(extractedContent);
        $inline.cloneAttrs($secondPart);
        $secondPart.append(div.innerHTML);
        $inline.after($secondPart);

        return $secondPart;
    }
    _insertInline(tag, point) {
        const insertion = new Insertion(this.app);
        return insertion.insertNode(document.createElement(tag), (point) ? point : 'start');
    }

    // tag
    _isSameTag(inline, tags) {
        return (inline && tags.indexOf(inline.tagName.toLowerCase()) !== -1);
    }
    _getTags() {
        let tags = [this.params.tag];
        if (this.params.tag === 'b' || this.params.tag === 'strong') {
            tags = ['b', 'strong'];
        }
        else if (this.params.tag === 'i' || this.params.tag === 'em') {
            tags = ['i', 'em'];
        }

        return tags;
    }
    _replaceTags() {
        let tags = this.config.get('replaceTags');
        let replaceTag = tags[this.params.tag];
        if (replaceTag) {
            return replaceTag;
        }

        return this.params.tag;
    }

    // convert
    _convertToStrike(inlines) {
        const utils = new Utils(this.app);
        const selection = new TextRange(this.app);

        //let inlines = selection.getNodes({ type: 'inline', link: true, buttons: true });
        let selected = selection.getText().replace(/[-[\]/{}()*+?.\\^$|]/g, "\$&");
        let tags = this._getTags();
        let inline, $inline, tag, hasSameArgs, convertable = false;


        for (let i = 0 ; i < inlines.length; i++) {
            inline = inlines[i];
            $inline = this.dom(inline);
            tag = inlines[i].tagName.toLowerCase();
            hasSameArgs = this._hasAllSameParams(inline);

            // link fully selected
            if (tag === 'a') {
                if (this.params.tag === 'span' && this._isFullySelected(inline, selected)) {
                    let css = utils.cssToObject($inline.attr('style'));
                    $inline.addClass('rx-inline-convertable');
                    $inline.removeAttr('data-rx-style-cache');
                    if (css && css['text-decoration']) {
                        $inline.attr('data-rx-inline-line', css['text-decoration']);
                    }
                    continue;
                }
            }

            if (tags.indexOf(tag) !== -1) {
                if (this.params.tag === 'span' && this._isFullySelected(inline, selected)) {
                    $inline.addClass('rx-inline-convertable');
                    $inline.removeAttr('data-rx-style-cache');
                }
                else if (hasSameArgs && this.params.tag !== 'a') {
                    this._replaceToStrike($inline);
                }
                else if (this.params.tag === 'span') {
                    if (this.params.style && this._hasSameStyle($inline)) {
                        convertable = true;
                    }
                    if (this.params.classname && this._hasSameClassname($inline)) {
                        convertable = true;
                    }

                    if (convertable) {
                        $inline.addClass('rx-inline-convertable');
                        $inline.removeAttr('data-rx-style-cache');
                    }
                    else {
                        $inline.addClass('rx-inline-unconvertable');
                    }
                }
                else if (!hasSameArgs) {
                    this._replaceToStrike($inline);
                }
            }
        }
    }
    _convertInlineBlocks($blocks) {
         $blocks.find('[data-rx-inline]').each(function($node) {
            if ($node.attr('contenteditable') === true) {
                $node.addClass('rx-inlineblock-editable').attr('contenteditable', false);
            }
        });
    }
    _convertTag(tag, $blocks) {
        let $el;

        if (this.params.tag !== tag) {
            $blocks.find(tag).each(function($node) {
                $el = $node.replaceTag('span');
                $el.addClass('rx-convertable-' + tag);
            });
        }
        else if (this.params.tag === 'del') {
            $blocks.find(tag).replaceTag('strike');
        }
    }
    _convertTags($blocks) {
        const utils = new Utils(this.app);

        this._convertTag('del', $blocks);
        this._convertTag('u', $blocks);
        this._convertTag('a', $blocks);
        this._convertInlineBlocks($blocks);

        $blocks.find('span').each(function($node) {
            let css = utils.cssToObject($node.attr('style'));
            if (css && css['text-decoration']) {
                $node.css('text-decoration', '');
                $node.attr('data-rx-convertable-style', css['text-decoration']);
                $node.addClass('rx-convertable-restore-style');
            }
        });
    }
    _replaceToStrike($el) {
        $el.replaceWith($node => {
            return this.dom('<strike>').append($node.contents());
        });
    }
    _revertInlineBlocks($blocks) {
        $blocks.find('.rx-inlineblock-editable').removeClass('rx-inlineblock-editable').attr('contenteditable', true);
    }
    _revertTag(tag, $blocks) {
        $blocks.find('span.rx-convertable-' + tag).replaceTag(tag).removeAttr('class');
    }
    _revertTags($blocks) {
        this._revertTag('a', $blocks);
        this._revertTag('u', $blocks);
        this._revertTag('del', $blocks);
        this._revertInlineBlocks($blocks);
    }
    _revertToInlines($blocks) {
        let $nodes = this.dom([]);
        if (this.params.tag !== 'u') {
            $blocks.find('u').unwrap();
        }

        // styled
        $blocks.each(function($node) {
            $node.find('*').each(function($el) {
                if ($el.get().style.textDecorationLine) {
                   $el.css('text-decoration-line', '');
                   $el.wrap('<u>');
                   if ($el.attr('style') === '') {
                       $el.removeAttr('style');
                   }
               }
           });
        });

        // span convertable
        $blocks.find('.rx-inline-convertable').each(function($node) {
            $node.find('strike').each(function($strike) {
                if ($node.text() === $strike.text()) {
                    $strike.unwrap();
                }
            });
            $node.removeClass('rx-inline-convertable');

            let unwrap = true;
            if ($node.hasClass('rx-convertable-a')) {
                $node = $node.replaceTag('a');
                $node.removeClass('rx-convertable-a');
                unwrap = false;
            }

            let lineDecoration = $node.attr('data-rx-inline-line');
            if (lineDecoration) {
                $node.css('text-decoration', lineDecoration);
                $node.removeAttr('data-rx-inline-line');
            }

            $node.removeEmptyAttr('class');
            if (unwrap && this._hasAllSameParams($node)) {
                $node.unwrap();
            } else {
                $nodes.add($node);
            }

        }.bind(this));

        // span unconvertable
        $blocks.find('span.rx-inline-unconvertable').each(function($node) {
            $node.removeClass('rx-inline-unconvertable');
            $node.removeEmptyAttr('class');

        }.bind(this));

        // restore style
        $blocks.find('span.rx-convertable-restore-style').each(function($node) {
            $node.removeClass('rx-convertable-restore-style');
            let textDecoration = $node.attr('data-rx-convertable-style');
            if (textDecoration && textDecoration !== 'null') {
                $node.css('text-decoration', textDecoration);
            }
           $node.removeAttr('data-rx-convertable-style');
        });

        // strike
        $blocks.find('strike').each(function($node) {
            $node = $node.replaceTag(this.params.tag);
            $nodes.add($node);
        }.bind(this));

        return $nodes;

    }
    _clearEmptyStyle() {
        const selection = new TextRange(this.app);

        let inlines = selection.getNodes({ type: 'inline' }),
            i = 0,
            max = inlines.length,
            childNodes,
            z = 0;

        for (i; i < max; i++) {
            this._clearEmptyStyleAttr(inlines[i]);

            childNodes = inlines[i].childNodes;
            if (childNodes) {
                for (z; z < childNodes.length; z++) {
                    this._clearEmptyStyleAttr(childNodes[z]);
                }
            }
        }
    }
    _clearEmptyStyleAttr(node) {
        if (node.nodeType !== 3 && node.getAttribute('style') === '') {
            node.removeAttribute('style');
        }
    }
    _clearSpanInside($node) {
        $node.find('span').each(function($el) {
            if (this.params.classname) {
                $el.removeAttr('class');
            }
            if (this.params.style) {
                for (let key of Object.keys(this.params.style)) {
                    $el.css(key, '');
                }
            }

            if ($el.attr('class') === '') $el.removeAttr('class');
            if ($el.attr('style') === '') $el.removeAttr('style');

            if ($el.get().attributes.length === 0) {
                $el.unwrap();
            }

        }.bind(this));
    }
    _isFullySelected(node, selected) {
        const utils = new Utils(this.app);
        const text = utils.removeInvisibleChars(node.textContent);

        return (selected === text || selected.search(new RegExp('^' + utils.escapeRegExp(text) + '$')) !== -1);
    }
}
class InlinePopupManager {
    constructor(app) {
        this.app = app;
        this.config = app.config;
        this.dropdown = app.dropdown;
        this.observer = app.observer;
    }

    popup(e, button) {
        const buttons = [...this.config.get('popups.inline')];
        const inlineItems = this.config.get('inlineItems');
        const activeKeys = this.observer.getKeys();

        Object.values(inlineItems || {}).forEach(item => {
            item.command = 'inline.set';
        });

        this.dropdown.create('inline', {
            items: buttons,
            extend: inlineItems,
            keys: activeKeys,
            type: 'inlinebar'
        });
        this.dropdown.open(e, button);
    }
}
class InputModule {
    constructor(app) {
        this.app = app;
        this.config = app.config;
    }

    handle(event) {
        const e = event.get('e');
        const key = e.which;
        const analyzer = new KeyAnalyzer(this.app, e);
        const selectHandler = new SelectHandler(this.app, e, key);
        const handlers = {
            'enter': new EnterHandler(this.app, e, key),
            'space': new SpaceHandler(this.app, e, key),
            'tab': new TabHandler(this.app, e, key),
            'arrow': new ArrowHandler(this.app, e, key),
            'delete': new DeleteHandler(this.app, e, key),
            'backspace': new DeleteHandler(this.app, e, key),
            'alpha': new AlphaHandler(this.app, e, key)
        };

        if (selectHandler.handleEvent(e)) {
            return;
        }

        Object.keys(handlers).forEach(name => {
            if (analyzer.is(name)) handlers[name].handleEvent(e);
        });
    }
}
class InputHandler {
    constructor(app, e, key) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;

        // local
        this.key = key;
        this.analyzer = new KeyAnalyzer(this.app, e);
    }

    // Private methods

    _trimInvisibleChar(e, pointer, remove) {
        const direction = pointer === 'left' ? 'before' : 'after';
        const selection = new TextRange(this.app);
        const offset = new Offset(this.app);
        const current = selection.getCurrent();

        if (!this._isInvisibleChar(selection, current, direction)) return;

        if (pointer === 'left') {
            this._removeChar(current, /\uFEFF/g);
        } else if (remove && current?.nextSibling) {
            this._removeChar(current.nextSibling, /\uFEFF/g);
        } else if (pointer === 'right') {
            e.preventDefault();
            this._adjustOffset(offset, 1);
            return true;
        }
    }

    _removeChar(element, regex) {
        if (!element) return;
        const text = element.textContent.replace(regex, '');
        this.dom(element).replaceWith(text);
    }

    _adjustOffset(offset, value) {
        const data = offset.get();
        offset.set({ start: data.start + value, end: data.end + value });
    }

    _isInvisibleChar(selection, current, type) {
        const utils = new Utils(this.app);
        const text = selection.getText(type);

        return current?.nodeType === 3 && utils.searchInvisibleChars(text) === 0;
    }


    _traverseNext(e, instance) {
        this._traverse(e, instance, 'getNext', 'getNextParent', 'start');
    }

    _traversePrev(e, instance) {
        this._traverse(e, instance, 'getPrev', 'getPrevParent', 'end');
    }

    _traverse(e, instance, nextMethod, parentMethod, position) {
        const next = instance[nextMethod]();
        if (next) {
            e.preventDefault();
            this.app.block.set(next, position);
            return;
        }

        const parent = instance[parentMethod]();
        if (parent) {
            e.preventDefault();
            this.app.block.set(parent, position);
            return;
        }

        if (this.analyzer.is('down+right')) {
            instance.insertEmpty({ position: 'after', caret: 'start', type: 'input' });
        }
    }
}
class AlphaHandler extends InputHandler {
    handleEvent(e) {
        const instance = this.app.block.get();
        if (instance && instance.isType('cell')) {
            instance.setEmpty();
            const $first = instance.getFirstElement();
            this.app.block.set($first, 'start');
        } else if (!instance.isEditable()) {
            const caret = new Caret(this.app);
            const newInstance = instance.insertEmpty({ position: 'after', type: 'input' });
            caret.set(newInstance.getBlock(), 'start');
            instance.remove({ broadcast: true });
            this.app.image.observeStates();
        } else if (instance && instance.isEditable() && instance.getClosest('cell')) {
            this.app.control.updatePosition();
        }

        this._handleEndOfLink();

        this.app.observer.observe();
    }

    // Private methods

    _handleEndOfLink() {
        const selection = new TextRange(this.app);
        const inline = selection.getInline();
        const caret = new Caret(this.app);
        if (inline && inline.tagName === 'A' && caret.is(inline, 'end')) {
            caret.set(inline, 'end');
        }
    }
}
class ArrowHandler extends InputHandler {
    handleEvent(e) {
        if (this.analyzer.is('ctrl') && this.analyzer.is('up')) {
            this._handleArrowCtrl(e);
            return;
        }
        if (this.analyzer.is('shift', 'alt', 'ctrl')) return;

        this._handleArrow(e);
    }

    // Private methods

    _handleArrowCtrl(e) {
        const selection = new TextRange(this.app);
        this.app.editor.unsetSelectAll();
        selection.remove();
        this.app.editor.setFocus('start');
    }

    _handleArrow(e) {
        if (this._handleSelectAll(e)) return;
        if (this._handleMultipleSelection(e)) return;

        const instance = this.app.block.get();
        if (!instance) return;

        if (this._handleInvisibleChar(instance, e)) return;
        if (this._handleBlockMethod(instance, e)) return;
        if (this._handleFirefoxFix(instance, e)) return;
        if (this._handleNonEditableBlock(instance, e)) return;
        if (this._handleEditableBlock(instance, e)) return;
    }

    _handleInvisibleChar(instance, e) {
        const isLeftOrRight = this.analyzer.is('left', 'right');
        const point = this.analyzer.is('left') ? 'left' : 'right';
        if (instance.isEditable() && isLeftOrRight && this._trimInvisibleChar(e, point)) {
            return true;
        }
    }

    _handleBlockMethod(instance, e) {
        if (!instance.handleArrow) return false;

        instance.handleArrow(e, this.key, this.analyzer);
        return true;
    }

    _handleNonEditableBlock(instance, e) {
        if (!instance.isEditable() || instance.isType(['todo', 'list'])) {
            const isPrev = this.analyzer.is('up+left');
            const traverse = isPrev ? this._traversePrev : this._traverseNext;

            traverse.call(this, e, instance);
            return true;
        }
    }

    _handleEditableBlock(instance, e) {
        if (!instance.isEditable()) return false;

        if (this.analyzer.is('down+right') && instance.isCaretEnd()) {
            const table = instance.getClosest('table')
            if (table) {
                e.preventDefault();
                const next = table.getNext()
                if (next) {
                    this.app.block.set(next, 'start');
                } else {
                    const newInstance = this.app.block.create();
                    table.insert({ instance: newInstance, position: 'after', type: 'input' });
                }

                return true;
            } else {
                let next = instance.getNext();
                if (next) {
                   e.preventDefault();
                   this.app.block.set(next, 'start');
                   return true;
                } else {
                    next = instance.getBlock().nextElement();
                    while (next) {
                        if (next.attr('data-rx-type')) {
                            e.preventDefault();
                            this.app.block.set(next, 'start');
                            return true;
                        }
                        next = next.nextElement().length === 0 ? null : next.nextElement();
                    }
                }
            }
        }
        else if (this.analyzer.is('up+left') && instance.isCaretStart()) {
            let prev = instance.getPrev();
            if (prev) {
               e.preventDefault();
               this.app.block.set(prev, 'end');
               return true;
            } else {
                prev = instance.getBlock().prevElement();
                while (prev) {
                    if (prev.attr('data-rx-type')) {
                        e.preventDefault();
                        this.app.block.set(prev, 'end');
                        return true;
                    }
                    prev = prev.prevElement().length === 0 ? null : prev.prevElement();
                }
            }
        }



        return false;
    }

    _handleFirefoxFix(instance, e) {
        const utils = new Utils(this.app);
        const selection = new TextRange(this.app);
        const { isFirstLine, isLastLine } = selection.isCursorInFirstOrLastLine();

        if (utils.isFirefox()) {
            if (this.analyzer.is('up') && isFirstLine) {
                const prev = instance.findPreviousElement();
                if (prev?.isType('text') && prev.isEmpty()) {
                    e.preventDefault();
                    this.app.block.set(prev, 'start');
                    return true;
                }
            } else if (this.analyzer.is('down') && isLastLine) {
                const next = instance.findNextElement();
                if (next?.isType('text') && next.isEmpty()) {
                    e.preventDefault();
                    this.app.block.set(next, 'start');
                    return true;
                }
            }
        }

        return false;
    }

    _handleSelectAll(e) {
        if (!this.app.editor.isSelectAll()) return false;

        e.preventDefault();
        const isDownRight = this.analyzer.is('down+right');
        const target = this.app.blocks.get({ last: isDownRight, first: !isDownRight });
        const point = isDownRight ? 'end' : 'start';

        this.app.editor.unsetSelectAll();
        this.app.block.set(target, point);
        return true;
    }

    _handleMultipleSelection(e) {
        if (!this.app.blocks.is()) return false;

        e.preventDefault();
        const isDownRight = this.analyzer.is('down+right');
        const target = this.app.blocks.get({ last: isDownRight, first: !isDownRight, selected: true });
        const selection = new TextRange(this.app);
        selection.collapse(isDownRight ? 'end' : 'start');

        this.app.block.set(target);
        this.app.context.close();
        return true;
    }


}
class DeleteHandler extends InputHandler {
    handleEvent(e) {
        const instance = this.app.block.get();

        if (instance && instance.isNondeletable()) return;
        if (this._handleColumn(instance, e)) return;
        if (this._handleEditorEmpty(e)) return;
        if (this._handleMultipleSelection(e)) return;

        if (this._handleInvisibleChar(instance, e)) return;
        if (this._handleInlineDeletion(e, instance)) return;

        if (!instance) return;

        if (this._handleBlockMethod(instance, e)) return;
        if (this._handleInlineBlockDeletion(e, instance)) return;
        if (this._handleNonEditableBlockDeletion(e, instance)) return;
        if (this._handleEditableBlockDeletion(e, instance)) return;

        this.app.observer.observe();
        this.app.image.observeStates();
    }

    // Private methods

    _handleBlockMethod(instance, e) {
        if (!instance.handleDelete) return false;

        instance.handleDelete(e, this.key, this.analyzer);
        this.app.image.observeStates();
        return true;
    }

    _handleInlineDeletion(e, instance) {
        const selection = new TextRange(this.app);
        const inline = selection.getInline();

        if (!inline) return false;
        const utils = new Utils(this.app);
        const html = utils.removeInvisibleChars(inline.innerHTML);
        if (html.length === 1) {
            e.preventDefault();
            if (inline.tagName === 'A') {
                const next = inline.nextSibling;
                const prev = inline.previousSibling;
                inline.remove();
                this._removeTrailingSpace(prev, next);
                this.app.observer.observe();
            } else {
                inline.innerHTML = '';
            }

            return true;
        }
        if (html.length === 0) {
            e.preventDefault();
            inline.remove();
            this.app.observer.observe();
            return true;
        }

        return false;
    }

    _removeTrailingSpace(prev, next) {
        if (prev && prev.nodeType === Node.TEXT_NODE && /\s$/.test(prev.nodeValue) && this.analyzer.is('backspace')) {
            prev.nodeValue = prev.nodeValue.replace(/\s+$/, '');
        }
        if (next && next.nodeType === Node.TEXT_NODE && next.nodeValue.startsWith('\u00A0')) {
            const replacer = this.analyzer.is('backspace') ? ' ' : '';
            next.nodeValue = next.nodeValue.replace(/^\u00A0+/, replacer);
        }
    }

    _handleInvisibleChar(instance, e) {
        const isDelete = this.analyzer.is('delete');
        const point = this.analyzer.is('backspace') ? 'left' : 'right';
        if (instance && instance.isEditable() && this._trimInvisibleChar(e, point, isDelete)) {
            return true;
        }
    }

    _handleMultipleSelection(e) {
        if (!this.app.blocks.is()) return false;

        e.preventDefault();
        const $first = this.app.blocks.get({ first: true, selected: true });
        const selection = new TextRange(this.app);

        selection.truncate();
        this.app.block.set($first, 'end');
        this.app.block.get().appendNext();
        this.app.context.close();
        this.app.image.observeStates();
        return true;
    }

    _handleEditorEmpty(e) {
        if (this.app.editor.isEmpty()) {
            e.preventDefault();
            return true;
        }
        return false;
    }

    _handleColumn(instance, e) {
        if (instance && instance.isType('column')) {
            e.preventDefault();
            return true;
        }
        return false;
    }

    _handleInlineBlockDeletion(e, instance) {
        if (!instance.isInline()) return false;

        const caret = new Caret(this.app);
        const $block = instance.getBlock();
        const $parent = $block.parent().closest('[data-rx-type]');

        if (instance.isEditable() && !instance.isAllSelected()) return false;

        e.preventDefault();
        caret.set($block, 'after');
        instance.remove();
        this.app.block.set($parent);
        this.app.context.close();
        return true;
    }

    _handleNonEditableBlockDeletion(e, instance) {
        if (instance && instance.isEditable()) return false;

        e.preventDefault();

        const next = instance.getNext();
        const prev = instance.getPrev();
        const type = instance.getType();
        const parentNeverEmpty = instance.getClosest(['column', 'cell']);

        if (type === 'image') {
            const data = {
                url: instance.getSrc(),
                id: instance.getId(),
                uid: instance.getDataImage(),
            };
            this.app.image.setImageState(instance, data, false);
            this.app.broadcast('image.remove', data);
        }

        instance.remove({ broadcast: true });

        if (parentNeverEmpty && parentNeverEmpty.isEmpty(true)) {
            const emptyBlock = this.app.block.create();
            parentNeverEmpty.insert({ instance: emptyBlock, position: 'append' });
            this.app.block.set(emptyBlock, 'start');
            return true;
        }

        this._setNextOrPreviousBlock(next, prev);
        return true;
    }

    _setNextOrPreviousBlock(next, prev) {
        if (next) {
            this.app.block.set(next, 'start');
        } else if (prev) {
            this.app.block.set(prev, 'end');
        } else if (this.app.editor.isEmpty()) {
            this.app.editor.setEmpty();
        } else {
            this.app.block.unset();
        }
    }

    _handleEditableBlockDeletion(e, instance) {
        if (!instance && instance.isEditable()) return false;

        const isBackspace = this.analyzer.is('backspace');
        const isDelete = this.analyzer.is('delete');
        const selection = new TextRange(this.app);

        if (instance.isAllSelected()) {
            e.preventDefault();
            instance.isType('quote') ? this.app.block.remove() : instance.setEmpty();
            this.app.context.close();
            return true;
        }

        if (this._handleDeleteAtEdges(e, instance, isBackspace, isDelete)) return true;

        if (!selection.isCollapsed()) {
            e.preventDefault();
            selection.truncate();
            this.app.context.close();
            return true;
        }

        return false;
    }

    _handleDeleteAtEdges(e, instance, isBackspace, isDelete) {
        const next = instance.getNext();
        const prev = instance.getPrev();

        if (isDelete && instance.isCaretEnd()) {
            this._handleDeleteAtEnd(e, instance, next);
            return true;
        } else if (isBackspace && instance.isCaretStart()) {
            this._handleBackspaceAtStart(e, instance, prev);
            return true;
        }

        return false;
    }

    _handleDeleteAtEnd(e, instance, next) {
        e.preventDefault();

        if (next) {
            if (!next.isEditable() && !next.isType(['list', 'todo'])) {
                this._setBlockAndRemoveIfEmpty(instance, next);
            } else if (next.getType() === 'pre' && instance.isEmpty()) {
                instance.remove({ broadcast: true });
            } else {
                instance.appendNext();
            }
        } else {
            const parentNeverEmpty = instance.getClosest(['column', 'cell']);
            if (parentNeverEmpty) e.preventDefault();
        }

        this.app.context.close();
    }

    _handleBackspaceAtStart(e, instance, prev) {
        const selection = new TextRange(this.app);
        const caret = new Caret(this.app);
        const utils = new Utils(this.app);
        const nodeBefore = selection.getCursorContext('before');

        if (nodeBefore && ['SPAN', 'SVG'].includes(nodeBefore.tagName)) {
            e.preventDefault();
            caret.set(nodeBefore, 'after');
            nodeBefore.remove();
            return;
        } else if (utils.isOnlySvgContent(instance.getBlock())) {
            e.preventDefault();
            instance.setEmpty()
            return;
        }

        e.preventDefault();
        if (prev) {
            if (!prev.isEditable() && !prev.isType(['list', 'todo'])) {
                this._setBlockAndRemoveIfEmpty(instance, prev, 'force');
            } else if (prev.getType() === 'pre' && instance.isEmpty()) {
                instance.remove({ broadcast: true });
            } else {
                instance.appendToPrev();
                this.app.control.updatePosition();
            }

            this.app.context.close();
            return;
        } else {
            const prevElement = instance.getBlock().prevElement();
            const parentNeverEmpty = instance.getClosest(['column', 'cell']);
            if (parentNeverEmpty) {
                e.preventDefault();
                return;
            }

            if (prevElement) {
                e.preventDefault();
                prevElement.remove();
                return;
            }
        }
    }

    _setBlockAndRemoveIfEmpty(instance, target, position = 'start') {
        this.app.block.set(target, position);

        if (instance.isEmpty()) {
            instance.remove({ broadcast: true });
        }
    }
}
class EnterHandler extends InputHandler {
    handleEvent(e) {
        this.analyzer.is('shift') || this.config.get('enterKey') === 'br' ? this._handleShiftEnter(e) : this._handleEnter(e);
    }

    // Private methods

    _handleEnter(e) {
        const instance = this.app.block.get();

        if (this._handleSpecialCases(instance, e)) return;
        if (this._handleMultipleSelection(e)) return;
        if (!instance) return;

        if (this._handleNonDeletable(instance, e)) return;
        if (this._handleInline(instance, e)) return;
        if (this._handleEditable(instance, e)) return;
        if (this._handleNonEditable(instance, e)) return;
        if (this._handleBlockMethod(instance, e)) return;

        // Custom or default block enter handling
        if (instance.isEditable()) {
            this._handleCustomTags(instance, e);
        }
    }

    _handleShiftEnter(e) {
        const instance = this.app.block.get();

        if (this._handleMultipleSelectionShift(e)) return;
        if (this._deleteInsideSelection(e)) return;

        if (!instance) return;
        if (instance.isInline()) {
            this._handleInline(instance, e);
        } else if (instance.isEditable()) {
            e.preventDefault();
            const insertion = new Insertion(this.app);
            insertion.insertBreakline();
        } else {
            e.preventDefault();
            this._insertAfter(instance);
        }
    }

    _handleCustomTags(instance, e) {
        e.preventDefault();

        if (instance.isEmpty() || instance.isCaretStart() || instance.isCaretEnd()) {
            const position = instance.isCaretStart() ? 'before' : 'after';
            instance.insertEmpty({ position, caret: 'start', remove: false, type: 'input' });
        } else {
            const splitter = new ElementSplitter(this.app)
            const $part = splitter.split(instance.getBlock());
            this.app.block.set($part, 'start');
        }
    }

    _handleBlockMethod(instance, e) {
        if (!instance.handleEnter) return false;

        instance.handleEnter(e, this.key, this.analyzer);
        this.app.image.observeStates();
        return true;
    }

    _handleSpecialCases(instance, e) {
        const sel = new TextRange(this.app);
        const range = sel.getRange();
        if (range && range.startContainer.tagName === 'A' && range.endContainer.tagName === 'A') {
            e.preventDefault();
            const caret = new Caret(this.app);
            caret.set(range.startContainer, 'after');
            range.startContainer.remove();
            return true;
        }
        if (instance && instance.isType('column')) {
            e.preventDefault();
            instance.insertEmpty({ position: 'prepend', caret: 'start', type: 'input' });
            return true;
        }
        return false;
    }

    _handleMultipleSelection(e) {
        if (!this.app.blocks.is()) return false;

        const blocks = this.app.blocks;
        if (!blocks.is()) return false;

        e.preventDefault();
        const $last = blocks.get({ last: true, selected: true });
        const selection = new TextRange(this.app);

        selection.truncate();
        setTimeout(() => {
            this.app.block.set($last);
            this.app.image.observeStates();
        }, 0);

        return true;
    }

    _handleMultipleSelectionShift() {
        const blocks = this.app.blocks;
        if (!blocks.is()) return false;

        e.preventDefault();
        const $first = blocks.get({ first: true, selected: true });
        const selection = new TextRange(this.app);
        const insertion = new Insertion(this.app);
        const caret = new Caret(this.app);

        selection.truncate();
        caret.set($first, 'end');
        insertion.insertBreakline();
        return true;
    }

    _handleNonDeletable(instance, e) {
        if (instance.isNondeletable() || (!instance.isInline() && this._deleteInsideSelection(e))) {
            return true;
        }
        return false;
    }

    _handleInline(instance, e) {
        if (!instance.isInline()) return false;

        e.preventDefault();
        const caret = new Caret(this.app);

        if (!instance.isEditable() || (instance.isEditable() && instance.isAllSelected())) {
            caret.set(instance.getBlock(), 'after');
            instance.remove();
        }

        return true;
    }

    _handleEditable(instance, e) {
        if (!instance.isEditable()) return false;

        const selection = new TextRange(this.app);
        const insertion = new Insertion(this.app);

        if (instance.isAllSelected()) {
            e.preventDefault();
            instance.setEmpty();
        } else if (!selection.isCollapsed()) {
            e.preventDefault();
            instance.isType('pre') ? insertion.insertNewline() : insertion.insertBreakline();
        } else {
            return false;
        }

        return true;
    }

    _handleNonEditable(instance, e) {
        if (instance.isEditable()) return false;

        e.preventDefault();

        if (instance.isType('list')) {
            this._handleList(instance);
        } else if (instance.isType('cell')) {
            this._handleCell(instance);
        } else {
            this._insertAfter(instance);
        }

        return true;
    }

    _handleList(instance) {
        const $parent = instance.getBlock().closest('li');
        if ($parent.length === 0) {
            instance.insertEmpty({ position: 'after', caret: 'start', type: 'input' });
        } else {
            instance.remove();
            this.app.block.set($parent, 'end');
        }
    }

    _handleCell(instance) {
        instance.getBlock().html('');
        const newInstance = this.app.block.create();
        instance.getBlock().append(newInstance.getBlock());
        this.app.editor.build();
        this.app.block.set(newInstance.getBlock(), 'start');
    }

    _insertAfter(instance) {
        instance.insertEmpty({ position: 'after', caret: 'start', type: 'input' });
        this.app.image.observeStates();
    }

    _deleteInsideSelection(e) {
        const selection = new TextRange(this.app);
        const caret = new Caret(this.app);

        if (!selection.isCollapsed()) {
            const blocks = selection.getNodes({ type: 'block' });
            if (blocks.length > 1) {
                e.preventDefault();
                selection.truncate();
                caret.set(blocks[0], 'end');
                return true;
            }
        }

        return false;
    }
}
class SelectHandler extends InputHandler {
    handleEvent(e) {
        // if select all & action key - make empty
        if (this._isAllSelected()) {
            return this._clearEditor(e);
        }

        // select block
        if (this.analyzer.is('select-block')) {
            return this._handleSelectBlock(e);
        }

        // select all
        if (this.analyzer.is('select')) {
            return this._handleSelectAll(e);
        }
    }

    // Private methods

    _handleSelectAll(e) {
        e.preventDefault();

        const instance = this.app.block.get();
        if (instance) {
            const cell = instance.getClosest('cell');
            const table = cell ? cell.getClosest('table') : false;
            const selection = new TextRange(this.app);

            if (table && !selection.isAll(table.getBlock())) {
                if (cell && selection.isAll(cell.getBlock())) {
                    this.app.block.set(table);
                    return true;
                } else if (cell) {
                    selection.select(cell.getBlock());
                    return true;
                }
            }
        }

        this.app.editor.setSelectAll();
        this.app.context.open(e);
        return true;
    }

    _handleSelectBlock(e) {
        const instance = this.app.block.get();
        if (!instance || !instance.isEditable()) return;

        e.preventDefault();

        const $target = this._getTargetForInstance(instance);
        const selection = new TextRange(this.app);

        selection.select($target);
        this.app.context.open(e);
    }

    _getTargetForInstance(instance) {
        if (instance.isType('todoitem')) {
            return instance.getContentItem();
        }
        if (instance.isType('quote')) {
            return instance.getCurrentItem();
        }
        return instance.getBlock();
    }

    _isAllSelected() {
        return (
            this.app.editor.isSelectAll() &&
            this.analyzer.is('enter', 'delete', 'backspace', 'alpha', 'space')
        );
    }

    _clearEditor(e) {
        if (!this.analyzer.is('alpha', 'space')) e.preventDefault();
        this.app.editor.setEmpty();
        this.app.statusbar.updatePosition();
        return true;
    }
}
class SpaceHandler extends InputHandler {
    handleEvent(e) {
        this.analyzer.is('shift') ? this._handleShiftSpace(e) : this._handleSpace(e);
    }

    // Private methods

    _handleSpace(e) {
        const instance = this.app.block.get();

        if (this._handleSpecialCases(e, instance)) return;
        if (this._handleMultipleSelection(e)) return;
        if (!instance) return;
        if (this._handleBlockMethod(instance, e)) return;
        if (this._handleInlineBlock(e, instance)) return;
        if (this._handleEditableBlock(e, instance)) return;
        if (this._handleNonEditableBlock(e, instance)) return;
    }

    _handleShiftSpace(e) {
        const instance = this.app.block.get();

        if (this._handleMultipleSelectionWithInsertion(e)) return;
        if (!instance) return;
        if (instance.isInline()) return;
        if (this._handleShiftEditableBlock(e, instance)) return;
    }

    _handleNonEditableBlock(e, instance) {
        if (instance.isEditable()) return false;

        e.preventDefault();

        if (instance.isType('cell')) {
            instance.getBlock().html('');
            const newInstance = this.app.block.create();
            instance.getBlock().append(newInstance.getBlock());
            this.app.editor.build();
            this.app.block.set(newInstance.getBlock(), 'start');
        } else {
            return false;
            //instance.insertEmpty({ position: 'after', caret: 'start', type: 'input' });
            //instance.remove({ broadcast: true });
            //this.app.image.observeStates();
        }

        return true;
    }

    _handleEditableBlock(e, instance) {
        if (!instance.isEditable() || !instance.isAllSelected()) return false;

        e.preventDefault();
        instance.setEmpty();
        return true;
    }

    _handleShiftEditableBlock(e, instance) {
        const insertion = new Insertion(this.app);

        if (instance.isEditable()) {
            if (instance.isAllSelected()) {
                e.preventDefault();
                instance.setEmpty();
                return true;
            } else if (!instance.isType('pre')) {
                e.preventDefault();
                insertion.insertHtml('&nbsp;', 'end');
                return true;
            }
        }

        return false;
    }

    _handleInlineBlock(e, instance) {
        if (!instance.isInline()) return false;

        if (!instance.isEditable() || (instance.isEditable() && instance.isAllSelected())) {
            e.preventDefault();
            const caret = new Caret(this.app);
            caret.set(instance.getBlock(), 'after');
            instance.remove();
        }
        return true;
    }

    _handleBlockMethod(instance, e) {
        if (!instance.handleSpace) return false;

        instance.handleSpace(e, this.key, this.analyzer);
        this.app.image.observeStates();
        return true;
    }

    _handleSpecialCases(e, instance) {
        if (instance && instance.isType(['column', 'embed'])) {
            e.preventDefault();
            return true;
        }
        return false;
    }

    _handleMultipleSelection(e) {
        if (!this.app.blocks.is()) return false;

        e.preventDefault();
        const $first = this.app.blocks.get({ first: true, selected: true });
        const caret = new Caret(this.app);
        const selection = new TextRange(this.app);

        selection.truncate();
        caret.set($first, 'end');
        this.app.image.observeStates();
        return true;
    }

    _handleMultipleSelectionWithInsertion(e) {
        if (!this.app.blocks.is()) return false;

        e.preventDefault();
        const $first = this.app.blocks.get({ first: true, selected: true });
        const selection = new TextRange(this.app);
        const insertion = new Insertion(this.app);
        const caret = new Caret(this.app);

        selection.truncate();
        caret.set($first, 'end');
        insertion.insertHtml('&nbsp;', 'end');
        return true;
    }
}
class TabHandler extends InputHandler {
    handleEvent(e) {
        if (this.config.is('tab.key')) {
            this._handleTab(e);
        }
    }

    // Private methods

    _handleTab(e) {
        const instance = this.app.block.get();
        if (this._handleMultipleSelection(e)) return;
        if (this._handleTableCellOrColumn(instance, e)) return;
        if (this._handleBlockMethod(instance, e)) return;
        if (this._handleTabAsSpaces(instance, e)) return;

        // Default behavior: traverse to the next element
        if (instance) this._traverseNext(e, instance);
    }

    _handleTabAsSpaces(instance, e) {
        if (!instance || !this.config.is('tab.spaces') || !instance.isEditable()) return false;

        e.preventDefault();
        const numSpaces = this.config.get('tab.spaces');
        const spaces = Array(numSpaces + 1).join('\u00a0');
        const insertion = new Insertion(this.app);

        insertion.insertNode(document.createTextNode(spaces), 'end');
        return true;
    }

    _handleBlockMethod(instance, e) {
        if (!instance || !instance.handleTab) return false;

        if (instance.handleTab(e, this.key, this.analyzer)) {
            return true;
        }

        return false;
    }

    _handleMultipleSelection(e) {
        if (!this.app.blocks.is()) return false;

        e.preventDefault();
        const selection = new TextRange(this.app);
        const instance = this.app.blocks.get({ last: true, selected: true });

        selection.collapse('end');
        this.app.block.set(instance);
        this.app.context.close();
        return true;
    }

    _handleTableCellOrColumn(instance, e) {
        if (!instance) return false;

        const parentCell = instance.getParent('cell');
        if (parentCell && parentCell.handleTab && parentCell.handleTab(e, this.key, this.analyzer)) {
            return true;
        }

        const parentColumn = instance.getParent('column');
        if (parentColumn && parentColumn.handleTab && parentColumn.handleTab(e, this.key, this.analyzer)) {
            return true;
        }

        return false;
    }
}
/*jshint esversion: 6 */
class EditorModule {
    constructor(app) {
        this.app = app;

        // local
        this.rawhtml = '';
    }

    init() {
        // Initialize utilities
        this.theme = new EditorTheme(this.app);
        this.app.theme = this.theme; // @deprecated 5.0
        this.focusManager = new EditorFocusManager(this.app, this);
        this.selectionManager = new EditorSelectionManager(this.app, this);

        this.buildStrategy = this.app.isMode('default')
            ? new NormalBuildStrategy(this.app, this)
            : new IframeBuildStrategy(this.app, this);

        this.buildStrategy.build();
    }

    stop() {
        this._removeOverlay();

        this.theme.stop();
        this.buildStrategy.stop();
        this._restoreDivElement();
    }

    load() {
        if (!this.app.isMode('iframe') && this.config.is('focus')) {
            this.setFocus(this.config.get('focus'));
        }
    }

    click() {
        const selection = new TextRange(this.app);
        const block = selection.getBlockControlled();

        // click to edit
        setTimeout(() => {
            this.app.block.set(block);
        }, 1);
    }

    readonly() {
        this.app.event.pause();
        this._toggleEditableState(false);

    }

    disable() {
        this.$editor.addClass('rx-editor-disabled');
        this._createOverlay();
    }

    editable() {
        this._toggleEditableState(true);
        this.app.event.run();
    }

    enable() {
        this.$editor.removeClass('rx-editor-disabled');
        this._removeOverlay();
    }

    destroy() {
        this._restoreTextareaAttributes();
        this.theme.destroy();
        this.buildStrategy.destroy();
    }

    build() {
        const classApplier = new ClassApplier(this.app);
        this.app.blocks.build();
        this.app.embed.build();
        this.app.image.observeStates();
        classApplier.parse(this.$editor);
        this.app.observer.observe();
    }

    save(el, type = false) {
        this.selectionManager.save(el, type);
    }

    restore(set) {
        this.selectionManager.restore(set);
    }

    resetSaved() {
        this.selectionManager.reset();
    }

    focus() {
        this.getLayout().focus({ preventScroll: true });
    }

    hasFocus() {
        return this.focusManager.hasFocus();
    }

    getTheme() {
        return this.theme.get();
    }

    getLayout() {
        return (this.app.isMode('iframe')) ? this.$layout : this.$editor;
    }

    getEditor() {
        return this.$editor;
    }

    getRect() {
        return this.$editor.rect();
    }

    getWidth() {
        return this.$editor.width();
    }

    getHtml() {
        return this.getLayout().html();
    }

    getEmail(cleanup) {
        return this.app.has('email') ? this.app.email.getEmail(cleanup) : this.getContent();
    }

    getContent(cleanup) {
        return this.content.getContent(cleanup);
    }

    getJson() {
        let data = {};
        if (this.app.has('email')) {
            data = this.app.email.getJson();
        }
        else {
            data = this.getSourceJson() || {};
            data.blocks = this.content.getJson();
        }

        return data;
    }

    getSourceJson() {
        return this.config.get('data');
    }

    getSource() {
        return this.$source.val();
    }

    getRawHtml() {
        return this.rawhtml;
    }

    getContentType() {
        return this.content.getType();
    }

    setTheme(theme) {
        this.theme.set(theme);
    }

    setContent(params) {
        if (this.app.has('email')) {
            this.app.email.setContent(params);
        } else {
            const insertion = new Insertion(this.app);
            insertion.set(params);
        }
    }

    setJson(data) {
        this.config.set('data', data);
        if (this.app.has('email')) {
            this.app.email.setJson(data);
        } else {
            this.content.set(data, 'json');
            this.build();
        }
    }

    setHtml(html) {
        this.getLayout().html(html);
    }

    setEmpty(broadcast = true) {
        const instance = this.app.block.create();
        const insertion = new Insertion(this.app);

        insertion.setEmpty();

        this.getLayout().append(instance.getBlock());
        this.build();
        this.setFocus('end');
        if (broadcast) {
            this.app.broadcast('editor.empty');
        }
    }

    setFocus(position, shouldBroadcast = true) {
        this.focusManager.setFocus(position, shouldBroadcast);
    }

    setBlurOther() {
        this.focusManager.setBlurOther();
    }

    setBlur(e) {
        this.focusManager.setBlur(e);
    }

    deselectAll() {
        this.selectionManager.deselectAll();
    }

    selectAll(blocks, shouldBroadcast = true) {
        this.selectionManager.selectAll(blocks, shouldBroadcast);
    }

    setSource(html) {
        this.$source.val(html);
    }

    setOutput(html) {
        if (!this.config.is('output')) return;

        const selector = this.config.get('output');
        const $el = this.dom(selector);
        const isInput = ['textarea', 'input'].includes($el.tag());

        isInput ? $el.val(html) : $el.html(html);
    }

    setWinFocus() {
        if (this.app.isMode('iframe')) {
            this.app.page.getWin().focus();
        }
    }

    insertContent(params) {
        const insertion = new Insertion(this.app);
        insertion.insert(params);
    }

    isSelectAll() {
        return this.$editor.hasClass('rx-select-all');
    }

    isEmpty() {
        const utils = new Utils(this.app);
        const html = this.getLayout().html();
        return utils.isEmptyHtml(html, true);
    }

    isEditor(el) {
        return (this.dom(el).get() === this.getLayout().get());
    }

    adjustHeight() {
        if (!this.app.isMode('iframe') || !this.$editor || this.app.isStopped()) return;

        setTimeout(() => {
            this.$editor.height(this.app.page.getFrameBody().height());
        }, 1);
    }

    // @deprecated 5.0
    unsetSelectAll() {
        this.deselectAll();
    }

    // @deprecated 5.0
    setSelectAll(blocks, broadcast) {
        this.selectAll(blocks, broadcast);
    }

    // Private methods

    _createOverlay() {
        this.$overlay = this.dom('<div>').addClass('rx-editor-overlay');
        this.app.container.get('main').append(this.$overlay);
    }

    _removeOverlay() {
        if (this.$overlay) {
            this.$overlay.remove();
        }
    }

    _restoreDivElement() {
        if (this.app.element.isTextarea()) return;

        this.$editor.removeClass('rx-editor rx-empty rx-editor-breakline ' + this.config.get('classname'));
        this.$editor.removeAttr('style dir');

        this.buildStrategy.restore();
        this.$editor.html(this.getContent());
    }

    _restoreTextareaAttributes() {
        if (this.app.element.isTextarea()) return;

        this.$editor.removeClass('rx-editor rx-editor-' + this.uuid + ' rx-empty rx-editor-breakline rx-editor-disabled rx-placeholder');
        this.$editor.removeAttr('contenteditable data-gramm_editor');
        this.app.container.get('main').before(this.$editor);
    }

    _toggleEditableState(state) {
        const func = state ? 'removeClass' : 'addClass';

        this.getLayout().attr('contenteditable', state);
        this.$editor[func]('rx-editor-readonly');

        if (state) {
            this.getLayout().find('[rx-readonly=true]').each($node => {
                $node.removeAttr('rx-readonly').attr('contenteditable', true);
            });
        } else {
            this.getLayout().find('[contenteditable=true]').each($node => {
                $node.attr('rx-readonly', true).attr('contenteditable', false);
            });
        }
    }
}
/*jshint esversion: 6 */
class EditorContent {
    constructor(app) {
        this.app = app;
        this.editor = app.editor;
        this.source = app.source;
        this.element = app.element;
        this.config = app.config;

        // local
        this.sourceType = this._determineSourceType();
        this.type = this.config.is('data') ? 'json' : 'html';

         // build
        this.content = this._getElementContent();
        this._broadcastBeforeLoad();
        this._parseContent();
        this._unparseContent();
    }

    getSourceType() {
        return this.sourceType;
    }

    getType() {
        return this.type;
    }

    getContent(cleanup) {
        let content;

        if (this.app.source.is()) {
            content = this.app.source.getContent();
        } else {
            content = this.editor.getHtml();
            content = this._unparse(content);
        }

        if (cleanup) {
            content = this._tidyContent(content);
        }

        return content;
    }

    getJson() {
        const blocks = [];
        const $layout = this.editor.getLayout();
        const $elms = $layout.children('[data-rx-type]');

        $elms.each($el => {
            const instance = $el.dataget('instance');
            blocks.push(instance.getJson());
        });

        return blocks;
    }

    set(content, type = 'html') {
        this.content = content;
        this.type = type;
        this._parseContent();
        this._unparseContent();
    }

    isJson() {
        return this.type === 'json';
    }

    // Private methods

    _determineSourceType() {
        if (this.config.is('content')) return 'content';
        if (this.config.is('data')) return 'data';
        return 'element';
    }

    _unparse(content) {
        const unparser = new Unparser(this.app);
        return unparser.unparse(content);
    }

    _tidyContent(content) {
        const tidy = new Tidy(this.app);
        return tidy.format(content);
    }

    _parseContent() {
        const parser = new Parser(this.app);
        const $nodes = parser.parse(this.content, { type: this.type, start: true, nodes: true });
        this.editor.setHtml($nodes);
    }

    _unparseContent() {
        const content = this._unparse(this.editor.getHtml());
        this.source.setContent(content);

        if (!this.isJson() && this.element.isTextarea()) {
            this.editor.setSource(content);
        }
    }

    _broadcastBeforeLoad() {
        const event = this.app.broadcast('editor.before.load', { html: this.content });
        this.content = event.get('html');
    }

    _getElementContent() {
        if (this.config.is('content')) {
            return this.config.get('content');
        }
        if (this.config.is('data')) {
            return this.config.get('data');
        }
        return this.app.element.getHtml();
    }
}
class EditorFocusManager {
    constructor(app, editor) {
        this.app = app;
        this.editor = editor;
        this.container = app.container;
        this.source = app.source;
        this.block = app.block;
        this.blocks = app.blocks;
        this.path = app.path;
        this.ui = app.ui;
    }

    hasFocus() {
        return this.container.hasFocus();
    }

    setFocus(position, shouldBroadcast = true) {
        if (position) {
            this._setFocusWithPosition(position);
            if (shouldBroadcast) {
                this.app.broadcast('editor.focus');
            }
        }
        else if (position !== false) {
            this._setFocusWithoutPosition();
        }
    }

    setBlurOther() {
        Redactor.instances.forEach(instance => {
            if (instance !== this.app && instance.editor) {
                instance.editor.setBlur();
            }
        });
    }

    setBlur(e) {
        if (!this.hasFocus() || !this.editor.getEditor()) return;

        let event = this.app.broadcast('editor.before.blur', { e: e });
        if (event.isStopped()) {
            if (e) e.preventDefault();
            return;
        }

        this.container.setBlur();
        this.editor.getEditor().removeClass('rx-select-all');
        this._clearSelection();

        this.app.broadcast('editor.blur', { e: e });
    }

    // Private methods

    _setFocusWithPosition(position) {
        const targetPosition = (position === true) ? 'start' : position;
        const $target = (targetPosition === 'start')
            ? this.blocks.get({ first: true })
            : this.blocks.get({ last: true });

        this.block.set($target, targetPosition);
        this.container.setFocus();
    }

    _setFocusWithoutPosition() {
        if (this.hasFocus()) return;

        this.setBlurOther();
        this.container.setFocus();
        this.container.toggleFocus();
        this.app.broadcast('editor.focus');
    }

    _clearSelection() {
        if (!this.source.is()) {
            this.block.unset();
            this.blocks.unset();
            this.ui.close();
            this.path.build();
            this.ui.unset();
        }
    }
}
class EditorSelectionManager {
    constructor(app, editor) {
        this.app = app;
        this.dom = app.dom;
        this.editor = editor;
        this.block = app.block;
        this.blocks = app.blocks;

        // local
        this.savedSelection = null;
        this.savedInline = null;
    }

    save(el, type = false) {
        if (type === 'inline') {
            this.savedInline = el;
            return;
        }

        const offset = new Offset(this.app);
        const instance = this.block.get();

        if (el !== false) {
            el = (instance && !this.blocks.is()) ? instance.getBlock() : this.editor.getLayout();
        }

        this.savedSelection = { el: el, offset: offset.get(el) };
    }

    restore(set) {
        if (!this.savedSelection) return;

        // focus
        this.editor.setWinFocus();

        if (this.savedInline) {
            this._restoreInlineCaret();
        } else {
            this._restoreBlockSelection(set);
        }

        // clear saved data
        this._clearSavedSelection();
    }

    reset() {
        this._clearSavedSelection();
    }

    selectAll(blocks, shouldBroadcast = true) {
        if (this.editor.isSelectAll()) return;

        const selection = new TextRange(this.app);

        this.editor.getEditor().addClass('rx-select-all');

        // Determine which blocks to select
        blocks = blocks || this.blocks.get({ firstLevel: true });

        this.block.unset();
        this.blocks.set(blocks);

        selection.select(this.editor.getLayout());

        if (shouldBroadcast) {
            this.app.broadcast('editor.select');
        }
    }

    deselectAll() {
        if (!this.editor.isSelectAll()) return;

        this.editor.getEditor().removeClass('rx-select-all');

        this.block.unset();
        this.blocks.unset();

        this.app.broadcast('editor.deselect');
        this.app.broadcast('editor.unselect'); // @deprecated 5.0
    }

    // Private methods

    _restoreInlineCaret() {
        const caret = new Caret(this.app);
        this.savedInline.innerHTML = '';
        caret.set(this.savedInline, 'start');
    }

    _restoreBlockSelection(set) {
        const { el, offset } = this.savedSelection;
        const instance = this.dom(el).dataget('instance');

        if (instance && set !== false) {
            this.block.set(el);
        }

        if (el && offset) {
            el.focus();

            const offsetManager = this.app.create('offset');
            offsetManager.set(offset, el);
        }
    }

    _clearSavedSelection() {
        this.savedSelection = null;
        this.savedInline = null;
    }
}
class EditorAccessibility {
    constructor(app) {
        this.app = app;
        this.loc = app.loc;
        this.uuid = app.uuid;
        this.dom = app.dom;
        this.container = app.container;
        this.$editor = app.editor.getEditor();

        this._assignAriaAttributes();
        this._prependAccessibilityLabel();
    }

    destroy() {
        this.$editor.removeAttr('aria-labelledby role');
    }

    // Private methods

    _assignAriaAttributes() {
        this.$editor.attr({ 'aria-labelledby': `rx-voice-${this.uuid}`, 'role': 'presentation' });
    }

    _prependAccessibilityLabel() {
        const html = this.loc.get('accessibility.help-label');
        const $label = this._createAccessibilityLabel(html);
        this.container.get('main').prepend($label);
    }

    _createAccessibilityLabel(html) {
        return this.dom('<span>').attr({
            'id': `rx-voice-${this.uuid}`,
            'aria-hidden': false
        }).addClass('rx-voice-label').html(html);
    }
}
/*jshint esversion: 6 */
class EditorTheme {
    constructor(app) {
        this.app = app;
        this.config = app.config;
        this.ui = app.ui;
        this.page = app.page;
        this.container = app.container;

        // local
        this.dataAttr = 'rx-data-theme';

        // initialize
        this._initialize();
    }

    stop() {
        this._removeTheme();
    }

    destroy() {
        this._removeMediaQueryListener();
    }

    set(theme) {
        this._applyTheme(theme);
        this._broadcastThemeChange(theme);
    }

    get() {
        return this.container.get('main').attr(this.dataAttr);
    }

    // Private methods

    _initialize() {
        const theme = this._getInitialTheme();
        const appTheme = this.config.get('theme');
        this.config.set('globalTheme', theme);

        if (appTheme === 'auto') {
            this._addMediaQueryListener();
            this.set(theme);
        } else {
            this.set(appTheme);
        }
    }

    _getInitialTheme() {
        if (this._getStoredTheme()) return this._getStoredTheme();
        return this._detectSystemTheme();
    }

    _getStoredTheme() {
        return localStorage.getItem('theme');
    }

    _detectSystemTheme() {
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            return 'dark';
        }
        return 'light';
    }

    _applyTheme(theme) {
        if (theme === 'auto') {
            theme = this._getInitialTheme();
        }

        this.container.get('main').attr(this.dataAttr, theme);
        this.ui.updateTheme(theme);

        if (this.app.isMode('iframe')) {
            const themeAttr = this.config.get('themeAttr');
            const $htmlEl = this.page.getFrameBody().closest('html');
            $htmlEl.attr(this.dataAttr, theme);
            if (themeAttr) {
                $htmlEl.attr(themeAttr, theme);
            }
        }
    }

    _broadcastThemeChange(theme) {
        this.app.broadcast('editor.theme', theme);
    }

    _removeTheme() {
        this.container.get('main').removeAttr(this.dataAttr);

        if (this.app.isMode('iframe')) {
            const themeAttr = this.config.get('themeAttr');
            const $htmlEl = this.page.getFrameBody().closest('html');
            $htmlEl.removeAttr(this.dataAttr);
            if (themeAttr) {
                $htmlEl.removeAttr(themeAttr);
            }
        }
    }

    _changeThemeOnSystemPreference() {
        const theme = this._detectSystemTheme();
        this.set(theme);
    }

    _addMediaQueryListener() {
        this._mediaQuery().addEventListener('change', this._changeThemeOnSystemPreference.bind(this));
    }

    _removeMediaQueryListener() {
        this._mediaQuery().removeEventListener('change', this._changeThemeOnSystemPreference.bind(this));
    }

    _mediaQuery() {
        return window.matchMedia('(prefers-color-scheme: dark)');
    }
}
class BuildStrategy {
    constructor(app, editor) {
        this.app = app;
        this.editor = editor;
        this.dom = app.dom;
        this.uuid = app.uuid;
        this.page = app.page;
        this.element = app.element;
        this.config = app.config;
        this.container = app.container;
        this.observer = app.observer;

        // local
        this.saved = false;
    }

    build() {
        throw new Error('Method build() must be implemented');
    }

    stop() {
        this.inputComposition.remove();
    }

    destroy() {
        this.a11y.destroy();
    }

    restore() {
        if (!this.element.isTextarea() && this.saved) {
            this.editor.$editor.attr('style', this.saved.style);
            this.editor.$editor.attr('dir', this.saved.dir);
        }
    }

    // Private methods

    _saveElementStyles() {
        if (!this.element.isTextarea()) {
            this.saved = {
                style: this.element.attr('style'),
                dir: this.element.attr('dir')
            };
        }
    }

    _setContainerStyles() {
        if (!this.config.is('container.border')) {
            this.container.get('main').css('border', 'none');
        }
    }

    _setupDraggable() {
        this._buildDraggable();
    }

    _buildVisibility() {
        this.editor.$editor.css('visibility', 'visible');
    }

    _buildInputComposition() {
        // input composition cutting
        this.inputComposition = this.dom('<input type="text" id="rxCompositionCutter' + this.uuid + '" style="position: fixed; left: -9000px; z-index: -1000; width: 1px; height: 1px;" />');
        this.page.getFrameBody().append(this.inputComposition);
    }

    _buildContent() {
        this.editor.rawhtml = this.element.getHtml().trim();
        this.editor.content = new EditorContent(this.app);
    }

    _buildBlurClass() {
        this.config.get('clicktoedit') ?  this.container.setFocus() : this.container.setBlur();
    }

    _buildAccessibility() {
        this.a11y = new EditorAccessibility(this.app);
    }

    _buildEditable() {
        this.app.getLayout().attr('contenteditable', true);
    }

    _buildDraggable() {
        this.page.getBody().find('[data-rx-drop-id]').each(($node) => {
            $node.attr('draggable', true);
            $node.on('dragstart', (e) => {
                const $target = this.dom(e.target);
                const id = $target.attr('data-rx-drop-id');
                e.dataTransfer.setData('item', id);
            });
        });
    }
}
class IframeBuildStrategy extends BuildStrategy {
    build() {
        this._buildInputComposition();
        this._buildElement();
        this._buildBlurClass();
        this._buildAccessibility();
        this._buildStartHtml();
    }

    // Private methods

    _buildElement() {
        this.editor.$editor = this._createIframe();
        this.editor.$source = this.element;
        this._appendEditorToContainer();
        this._setupIframeLoadHandler();
    }

    _createIframe() {
        const $iframe = this.dom('<iframe>')
            .addClass('rx-editor-frame')
            .css({ visibility: 'hidden', margin: '0 auto', padding: '0' });

        if (!this.config.is('maxHeight')) {
            $iframe.attr('scrolling', 'no');
        }

        return $iframe;
    }

    _appendEditorToContainer() {
        this.container.get('editor').append(this.editor.$editor);
    }

    _setupIframeLoadHandler() {
        this.editor.$editor.on('load', this._onload.bind(this));
    }

    _buildOptions() {
        const options = this.config.dump();
        this._saveElementStyles();
        this._setEditorAttributesAndStyles(options);
        this._setContainerStyles();
    }

    _setEditorAttributesAndStyles({ dir, width = '100%', padding, minHeight, maxHeight, notranslate, spellcheck, grammarly }) {
        const layoutDir = this.element.attr('dir') || dir;
        this.editor.$layout.attr('dir', layoutDir).css({
            'max-width': width,
            'padding': padding,
            'min-height': minHeight,
            'max-height': maxHeight,
            'overflow': maxHeight ? 'auto' : null
        });

        if (this.config.is('tabindex')) {
            this.editor.$editor.attr('tabindex', this.config.get('tabindex'));
        }

        if (notranslate) this.editor.$layout.addClass('notranslate');
        if (!spellcheck) this.editor.$layout.attr('spellcheck', false);
        if (!grammarly) this.editor.$layout.attr('data-gramm_editor', false);
    }

    _buildLayout() {
        const $body = this.page.getFrameBody();
        this.editor.$layout = $body.children().first();
        this._applyLayoutClasses();
        $body.css('height', 'auto');
    }

    _applyLayoutClasses() {
        const classname = this.config.get('classname');
        this.editor.$layout
            .attr('dir', this.config.get('dir'))
            .addClass('rx-editor rx-editor-' + this.uuid + ' rx-empty');

        if (this.config.is('breakline')) {
            this.editor.$layout.addClass('rx-editor-breakline');
        }
        if (this.config.is('structure')) {
            this.editor.$layout.addClass('rx-editor-wym');
        }
        if (!this.config.is('nostyle')) {
            this.editor.$layout.addClass(classname);
        }
    }

    _buildStartHtml() {
        const code = this._generateHtmlDocument();
        this._writeCode(code);
    }

    _generateHtmlDocument() {
        const doctype = this._createDoctype();
        const headScripts = this._buildCustomJs();
        const layout = `<div class="${this.config.get('classname')}"></div>`;
        const frameLang = this.config.is('frame.lang') ? ` lang="${this.config.get('frame.lang')}"` : '';
        const frameDir = this.config.is('frame.dir') ? ` dir="${this.config.get('frame.dir')}"` : '';
        const meta = '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">';
        const scripts = this._createScripts();
        return `${doctype}<html${frameLang}${frameDir}><head>${meta}${headScripts}</head><body style="padding: 0; margin: 0; width: 100%;">${layout}${scripts}</body></html>`;
    }

    _buildCustomJs() {
        if (!this.config.is('custom.js')) return '';
        return this._processScripts(this.config.get('custom.js'), true);
    }

    _createDoctype() {
        return `${this.config.get('doctype')}\n`;
    }

    _createScripts() {
        if (!this.config.is('custom.js')) return '';
        return this._processScripts(this.config.get('custom.js'));
    }

    _processScripts(scripts, head = false) {
        return scripts
            .flatMap(script => this._normalizeScript(script))
            .filter(script => script.head === head)
            .map(script => this.dom('<script>').attr('src', script.src).outer())
            .join('');
    }

    _normalizeScript(script) {
        if (typeof script === 'string') {
            return { src: script, head: false };
        }
        if (typeof script === 'object' && script !== null && !Array.isArray(script)) {
            return script;
        }
        return [];
    }

    _writeCode(html) {
        const doc = this.page.getDocNode();
        doc.open();
        doc.write(html);
        doc.close();
    }

    _onload() {
        this._buildLayout();
        this._buildOptions();
        this._buildContent();
        this._buildEditable();
        this._loaded();
    }

    _loaded() {
        this._initializeApp();
        this._buildVisibility();
        this._buildEditorCss();
        this._buildCustomCss();
        this._setupDraggable();
        this._adjustOnResize();
        this._finalizeLoading();
    }

    _initializeApp() {
        const { app } = this.app;
        app.event.build();
        app.placeholder.build();
        app.placeholder.trigger();
        app.blocks.build();
        app.sync.build();
        app.embed.build();
        app.image.observeStates();
    }

    _buildEditorCss() {
        const cssPath = this.config.get('css') + this.config.get('cssFile');
        this._buildCssLink(cssPath);
    }

    _buildCustomCss() {
        if (!this.config.is('custom.css')) return;
        this.config.get('custom.css').forEach(css => this._buildCssLink(css));
    }

    _buildCssLink(href) {
        const cacheSuffix = this.config.is('csscache') ? '' : (href.includes('?') ? '&' : '?') + new Date().getTime();
        const $link = this.dom('<link>').attr({
            'class': 'rx-css',
            'rel': 'stylesheet',
            'href': href + cacheSuffix
        });
        this.page.getFrameHead().append($link);
    }

    _adjustOnResize() {
        this.page.getWin().on('resize.rx-editor-frame', this.editor.adjustHeight.bind(this));
    }

    _finalizeLoading() {
        this.app.loaded = true;
        this.app.broadcast('editor.load');

        // adjust height & build observer
        this.editor.adjustHeight();
        setTimeout(() => {
            if (this.app.isStopped()) return;

            this.editor.adjustHeight();
            this.editor.getEditor().focus();
            this.editor.setFocus(this.config.get('focus'));
            this.observer.build();
            this.app.broadcast('editor.ready');

            // If editor is inside hidden elements
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        this.editor.adjustHeight();
                    }
                });
            }, { threshold: 0 });

            observer.observe(this.editor.$editor.get());
        }, 500);
        setTimeout(() => this.editor.adjustHeight(), 3000);
    }
}
class NormalBuildStrategy extends BuildStrategy {
    build() {
        this._initializeBuild();
        this._finalizeBuild();
    }

    // Private methods

    _initializeBuild() {
        this._buildInputComposition();
        this._buildElement();
        this._buildOptions();
        this._buildBlurClass();
        this._buildAccessibility();
        this._buildEditable();
        this._buildContent();
    }

    _finalizeBuild() {
        this._load();
    }

    _buildElement() {
        const $cont = this.container.get('editor');
        const isTextarea = this.element.isTextarea();
        const classname = this.config.get('classname');
        const shouldAddClassname = !(this.config.is('nostyle') && classname === 'rx-content');

        // Create editor & source
        this.editor.$editor = isTextarea ? this.dom('<div>') : this.element;
        this.editor.$source = isTextarea ? this.element : this.dom('<textarea>').hide();

        // Add classe
        this._addEditorClasses(shouldAddClassname);
        this._addEditorToContainer($cont, isTextarea);
    }

    _addEditorClasses(shouldAddClassname) {
        if (shouldAddClassname) {
            this.editor.$editor.addClass(this.config.get('classname'));
        }
        if (this.config.is('breakline')) {
            this.editor.$editor.addClass('rx-editor-breakline');
        }
        if (this.config.is('structure')) {
            this.editor.$editor.addClass('rx-editor-wym');
        }

        this.editor.$editor.addClass(`rx-editor rx-editor-${this.uuid} rx-empty`);
    }

    _addEditorToContainer($cont, isTextarea) {
        $cont.append(this.editor.$editor);
        if (!isTextarea) {
            $cont.append(this.editor.$source);
        }
    }

    _buildOptions() {
        const options = this.config.dump();
        const { dir, width = '100%', padding, minHeight, maxHeight, notranslate, spellcheck, grammarly } = options;

        this._saveElementStyles();
        this._setEditorAttributesAndStyles({ dir, width, padding, minHeight, maxHeight, notranslate, spellcheck, grammarly });
        this._setContainerStyles();
    }

    _setEditorAttributesAndStyles({ dir, width, padding, minHeight, maxHeight, notranslate, spellcheck, grammarly }) {
        const editorStyles = {
            'max-width': this.config.is('nocontainer') ? null : width,
            'padding': this.config.is('nocontainer') ? null : padding,
            'min-height': minHeight || null,
            'max-height': maxHeight || null,
            'overflow': maxHeight ? 'auto' : null
        };
        this.editor.$editor.css(editorStyles);

        // Attribute setting
        this._setEditorAttributes(dir, notranslate, spellcheck, grammarly);
    }

    _setEditorAttributes(dir, notranslate, spellcheck, grammarly) {
        if (this.config.is('tabindex')) {
            this.editor.$editor.attr('tabindex', this.config.get('tabindex'));
        }
        this.editor.$editor.attr('dir', this.element.attr('dir') || dir);
        if (notranslate) this.editor.$editor.addClass('notranslate');
        if (!spellcheck) this.editor.$editor.attr('spellcheck', false);
        if (!grammarly) this.editor.$editor.attr('data-gramm_editor', false);
    }

    _load() {
        try {
            this._loaded();
        } catch(e) {
            throw e;
        }
    }

    _loaded() {
        this._initializeApp();
        this._setupDraggable();
        this._broadcastLoadEvent();
    }

    _initializeApp() {
        const { app } = this.app;
        app.event.build();
        app.placeholder.build();
        app.placeholder.trigger();
        app.blocks.build();
        app.sync.build();
        app.embed.build();
        app.observer.build();
        app.image.observeStates();
    }

    _broadcastLoadEvent() {
        this.app.loaded = true;
        this.app.broadcast('editor.load');
    }
}
class EventModule {
    constructor(app) {
        this.app = app;

        // local
        this.eventTrigger = true;
        this.eventPause = false;
        this.eventMouseDown = false;
        this.eventDoubleClick = false;
        this.eventTripleClick = false;
        this.eventPaste = false;
        this.eventTabFocus = false;
        this.eventImageDrag = false;
        this.preventName = 'rx-prevent-events';
    }

    init() {
        // strategy
        this.eventStrategy = this.app.isMode('default')
            ? new NormalEventStrategy(this.app, this)
            : new IframeEventStrategy(this.app, this);
    }

    build() {
        const buildInterval = setInterval(() => {
            if (this.app.isStarted() && !this.app.isReadonly()) {
                this._stopLinkEvents();
                this.eventStrategy.start();
                clearInterval(buildInterval);
            }
        }, 1);
    }

    stop() {
        this._offPreventEvents();
        this.eventStrategy.stop();
    }

    run() {
        this._setPause(false);
        this._stopLinkEvents();
        this.eventStrategy.start();
    }

    pause() {
        this._setPause(true);
        this.eventStrategy.stop();
        this._offPreventEvents();
    }

    isPaused() {
        return this.eventPause;
    }

    isPasteEvent() {
        return this.eventPaste;
    }

    isTrigger() {
        return this.eventTrigger;
    }

    isTabFocus() {
        return this.eventTabFocus;
    }

    isMouseDown() {
        return this.eventMouseDown;
    }

    isImageDrag() {
        return this.eventImageDrag;
    }

    isDoubleClick() {
        return this.eventDoubleClick;
    }

    isTripleClick() {
        return this.eventTripleClick;
    }

    isToolClick(e) {
        const $target = this.dom(e.target);
        if ($target.closest('.rx-in-tool').length !== 0) {
            this.app.block.setTool(true);
            return true;
        }

        return false;
    }

    isEditorClick(e) {
        if (this.app.editor.isEditor(e.target)) {
            e.preventDefault();
            return true;
        }
        return false;
    }

    isEditorFocus() {
        if (this.app.dropdown.isOpen() || this.app.source.is()) {
            return false;
        } else {
            return (this.app.block.is() || this.app.blocks.is() || this.app.editor.isSelectAll());
        }
    }

    isOutsideEditor(e) {
        const $target = this.dom(e.target);
        const targets = ['-dropdown-', '-form-', '-toolbar-container-', '-source-container-', '-control-', '-context-', '-pathbar-'];
        const targetSelectors = targets.map(target => `.rx${target}${this.uuid}`).join(',');

        return !$target.closest(`${targetSelectors}, .rx-option-list, .rx-editor-${this.uuid}`).length;
    }

    isEditorContainer(e) {
        const type = (this.app.isMode('iframe')) ? 'editor' : 'container';
        return this.dom(e.target).closest(`.rx-${type}-${this.uuid}`).length !== 0;
    }

    setStrategyMouseUp(value) {
        this.eventStrategy.isPopupMouseUp = value;
    }

    setPasteEvent(value) {
        this.eventPaste = value;
    }

    setTrigger(value) {
        this.eventTrigger = value;
    }

    setImageDrag(value) {
        this.eventImageDrag = value;
    }

    setMouseDown(value) {
        if (value) {
            this.eventMouseDown = {
                type: this.app.editor.isEditor(value.target) ? 'editor' : 'block',
                event: value
            };
        } else {
            this.eventMouseDown = value;
        }
    }

    setDoubleClick(value) {
        this.eventDoubleClick = value;
    }

    setTripleClick(value) {
        this.eventTripleClick = value;
    }

    setTabFocus(value) {
        this.eventTabFocus = value;
    }

    setMultipleBlocks() {
        this.selector = new EventBlockSelector(this.app, this);
        this.selector.setMultiple();
    }

    getImageDrag(value) {
        return this.eventImageDrag;
    }

    getMouseDown() {
        return this.eventMouseDown;
    }

    checkTabFocus(e) {
        this.setTabFocus(e.key === 'Tab');
    }

    checkPopupsOpen(e) {
        if (this.app.dropdown.isOpen()) {
            this.app.dropdown.close();
        }
    }

    checkPanelKeys(e) {
        const key = e.which;
        const isPanel = this.app.dropdown.isOpen() && this.app.dropdown.isPanel();
        if (isPanel && (e.key === 'Enter' || [37, 38, 39, 40].includes(key))) {
            e.preventDefault();
            return true;
        }
        return false;
    }

    handleTextareaTab(e) {
        if (e.keyCode !== 9) return true;
        e.preventDefault();

        let el = e.target,
            val = el.value,
            start = el.selectionStart;

        el.value = val.substring(0, start) + "    " + val.substring(el.selectionEnd);
        el.selectionStart = el.selectionEnd = start + 4;
    }

    // Private methods

    _setPause(value) {
        this.eventPause = value;
    }

    _stopLinkEvents() {
        this.app.editor.getLayout().on(`click.${this.preventName} dblclick.${this.preventName}`, this._stopLinkEvent.bind(this));
    }

    _stopLinkEvent(e) {
        if (this.dom(e.target).closest('a').length) {
            e.preventDefault();
        }
    }

    _offPreventEvents() {
        this.app.editor.getLayout().off(`.${this.preventName}`);
    }

    _removeDrag() {
        this.app.editor.getLayout().find('.rx-draggable-placeholder').remove();
    }
}
class EventBlockSelector  {
    constructor(app, event) {
        this.app = app;
        this.dom = app.dom;
        this.event = event;
        this.block = app.block;
        this.blocks = app.blocks;
        this.editor = app.editor;
    }

    handleMouseUp(e) {
        const selection = new TextRange(this.app);
        const svgTarget = this.dom(e.target).closest('svg');
        if (svgTarget.length) {
            const spanParent = svgTarget.parent('span');
            const caret = new Caret(this.app);
            caret.set(spanParent.length ? spanParent : svgTarget, 'after');
            return;
        }

        const $block = this._getBlockFromTarget(e.target);
        const instance = $block.dataget('instance');
        let blocks = selection.getRange()
            ? this._normalizeBlocks(selection.getNodes({ partial: true }))
            : instance ? [instance] : [];

        if (selection.isCollapsed()) {
            blocks = [blocks[blocks.length-1]];
        }

        if (instance && instance.isType('image')) {
            // outside multiple selection
            if (this.blocks.is() && !$block.hasClass('rx-block-meta-focus')) {
                this._setOne(e, selection);
            } else {
                this._setOne(false, selection, $block);
            }
            return;
        }

        // selection started or ended outside blocks
        if (this.event.isMouseDown()) {
            const eventMouseDown = this.event.getMouseDown();
            if (eventMouseDown.type === 'block') {
                if (blocks.length === 1) {
                    this._setOne(eventMouseDown.event, selection);
                } else {
                    if (this.event.isDoubleClick() || this.event.isTripleClick()) {
                        this._setOne(eventMouseDown.event, selection);
                    } else {
                        this._setMultiple(eventMouseDown.event, selection, blocks);
                    }
                }
            } else {
                if (blocks.length === 1) {
                    this._setOne(false, selection, blocks[0]);
                } else {
                    this._setMultiple(false, selection, blocks);
                }
            }


        } else if (this.event.isEditorClick(e) && selection.isCollapsed()) {
            // one by coords
            this._setByCoords(e);
        }
        else if (selection.isCollapsed() || blocks.length === 1) {
            // one
            this._setOne(e, selection);
        }
        else if (blocks.length > 1) {
            // multiple
            this._setMultiple(e, selection, blocks);
        }
    }

    setByClick(e) {
        let block = false;
        if (this.event.isDoubleClick() || this.event.isTripleClick()) {
            block = this._getBlockFromTarget(e.target);
        }
        const selection = new TextRange(this.app);
        this._setOne(e, selection, block);
    }

    setMultiple() {
        const selection = new TextRange(this.app);
        const blocks = selection.getNodes({ type: 'block', partial: true });
        this._setMultiple(false, selection, blocks);
    }

    // Private methods

    _setMultiple(e, selection, blocks) {
        this.editor.setFocus();
        this.editor.deselectAll();

        const inspector = new ElementInspector(this.app);
        const $block = (e) ? this._getBlockFromTarget(e.target) : false;

        if (selection.isFullySelected()) {
            this._handleFullSelection(selection);
        } else if (blocks.length > 1) {
            this._handleMultipleBlocks(inspector, blocks, $block);
        }
    }

    _setOne(e, selection, block = false) {
        this.editor.setFocus();
        const $block = block ? this.dom(block) : this._getBlockFromTarget(e.target);

        if ($block.length) {
            const instance = $block.dataget('instance');
            const point = (instance && instance.isEditable()) ? false : 'force';
            const force = point !== false;

            this.editor.setFocus();
            this.block.set($block, point, force);

            if (instance && instance.isType('image')) {
                this.app.broadcast('image.click', { instance, data: instance.getData() });
            } else if (instance && instance.isType('embed')) {
                this.app.broadcast('embed.click', { instance, content: instance.getContent() });
            }

            // inline tracking
            const inline = selection.getInline();
            if (inline && inline.tagName === 'A') {
                this.app.broadcast('link.click', { element: this.dom(inline) });
            }

            // range selection if fully selected
            if (instance.isAllSelected()) {
                selection.select($block.get());
            }
        }
    }

    _setByCoords(e) {
        const $blocks = this.blocks.get({ firstLevel: true });
        const coords = [];
        const distances = [];
        let heightIndex = false;

        $blocks.each($node => {
            const rect = $node.get().getBoundingClientRect();
            coords.push([rect.x, rect.y, rect.y + rect.height]);
        });

        coords.forEach((coord, index) => {
            const y = e.clientY;
            const x = e.clientX;

            if (coord[1] < y && y < coord[2]) {
                heightIndex = index;
                return;
            }

            const distance = Math.hypot(coord[0] - x, coord[1] - y);
            distances.push(distance);
        });

        const closestIndex = heightIndex !== false ? heightIndex : distances.indexOf(Math.min(...distances));
        const $block = $blocks.eq(closestIndex);

        this.editor.setFocus();
        this.block.set($block, 'start');
    }

    _setMultipleBlocks(blocks) {
        this.block.unset();
        this.blocks.set(blocks);
    }

    _setSingleBlock($block) {
        this.block.set($block);
        this.blocks.unset();
    }

    _handleMultipleBlocks(inspector, blocks, $block) {
        if (this._checkInside(inspector, blocks, 'quote')) {
            $block = inspector.getDataBlock($block, 'quote');
            this._setSingleBlock($block);
        }
        else if (this._checkInside(inspector, blocks, 'noneditable')) {
            $block = inspector.getDataBlock($block, 'noneditable');
            this._setSingleBlock($block);
        }
        else {
            this._setMultipleBlocks(blocks);
        }
    }

    _handleFullSelection(selection) {
        const blocksAll = this.blocks.get({ firstLevel: true });
        const nodes = selection.getNodes({ type: 'block-first' });

        if (blocksAll.length === nodes.length) {
            this.editor.selectAll(blocksAll);
        }
    }

    _checkInside(inspector, blocks, type) {
        return blocks.every(block => inspector.hasParent(block, type));
    }

    _normalizeBlocks(blocks) {
        const normalized = blocks.map(block => {
            let $block = this.dom(block);
            if (!$block.attr('data-rx-type')) {
                $block = $block.closest('[data-rx-type]');
            }
            return $block.get();
        });

        // Remove duplicates
        return [...new Set(normalized)];
    }

    _getBlockFromTarget(target) {
        return this.dom(target).closest('[data-rx-type]');
    }
}
class EventBus {
    constructor(app) {
        this.app = app;
        this.events = {};
    }

    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
    }

    // Emit with EventData
    emit(event, eventData = {}) {
        const eventDataInstance = new EventData(this.app, event, eventData);

        if (this.events[event]) {
            for (const listener of this.events[event]) {
                const result = listener.call(this.app, eventDataInstance);
                if (result !== undefined) {
                    eventDataInstance.set('result', result);
                }
                if (eventDataInstance.isStopped()) {
                    break;
                }
            }
        }

        // @deprecated 5.0
        this._broadcastPlugins(event, eventDataInstance);

        return eventDataInstance;
    }

    // Emit for HTML string
    emitHtml(event, html) {
        if (typeof html !== 'string') {
            throw new Error('emitHtml expects an HTML string as the third argument.');
        }

        if (this.events[event]) {
            for (const listener of this.events[event]) {
                const result = listener.call(this.app, html);
                if (result !== undefined) {
                    html = result;  // Update HTML if the listener modifies it
                }
            }

            return html;  // Return the final HTML string
        }

        // @deprecated 5.0
        this.count = 0;
        const eventDataInstance = new EventData(this.app, event, { html: html });
        this._broadcastPlugins(event, eventDataInstance);
        if (this.count !== 0) {
            return eventDataInstance.get('html');
        }

        return html;  // Return original HTML if no listeners are registered
    }


    // @deprecated 5.0: use on inside plugins
    _broadcastPlugins(name, eventData) {
        this.app._plugins.forEach(plugin => {
            this.count++;
            const pluginInstance = this.app[plugin];
            const { subscribe } = pluginInstance;

            if (!subscribe) return;

            Object.entries(subscribe).forEach(([keys, handler]) => {
                keys.split(',').map(ns => ns.trim()).forEach(ns => {
                    if (ns === name) {
                        if (typeof handler === 'string') {
                            pluginInstance[handler](eventData);
                        } else {
                            handler.call(pluginInstance, eventData);
                        }
                    }
                });
            });
        });
    }
}
class EventClipboardHandler  {
    constructor(app, event) {
        this.app = app;
        this.event = event;
        this.config = app.config;
        this.block = app.block;
        this.blocks = app.blocks;
        this.editor = app.editor;
        this.image = app.image;
        this.control = app.control;
        this.context = app.context;
        this.placeholder = app.placeholder;
    }

    getPasteType(e) {
        const data = e.clipboardData;
        let html = data.getData('text/html');
        let text = data.getData('text/plain');
        let rtf = data.getData('text/rtf');

        let result = '';

        if (html) {
            if (rtf) {
                result = 'html+rtf';
            } else {
                result = 'html';
            }
        } else if (text) {
            result = 'text'
        } else if (rtf) {
            result = 'rtf';
        }

        return result;
    }

    handlePaste(e) {
        e.preventDefault();

        const clipboardData = e.clipboardData;
        const clipboard = new Clipboard(this.app);
        const insertion = new Insertion(this.app);
        const utils = new Utils(this.app);
        const remover = new CleanerRemover(this.app);
        const autoparse = new Autoparse(this.app);
        const encoder = new CleanerEncoder(this.app);

        let html = clipboard.getContent(clipboardData);

        const url = clipboardData.getData('URL');
        const rtf = clipboardData.getData('text/rtf');
        const instance = this.block.get();
        const isPlainHtml = clipboard.isPlainHtml(clipboardData);
        let isPlainText = clipboard.isPlainText(clipboardData);

        const encodeType = this.getPasteType(e);
        if (encodeType === 'text') {
            html = encoder.encodeEntities(html);
        }

        let pre = false;
        let clean = true;
        let parse = true;

        // image handling
        if (this._handleImagePaste(e, clipboardData)) return;

        this.event.setPasteEvent(true);
        const event = this.app.broadcast('editor.before.paste', { e: e, html: html });
        if (event.isStopped()) {
            this.event.setPasteEvent(false);
            return;
        }

        if (event.has('isPlainText')) {
            isPlainText = event.get('isPlainText');
        }

        html = event.get('html');
        // get safari anchor links
        html = (!url || url === '') ? html : url;

        // clean
        if (this.config.is('paste.plaintext')) {
            clean = false;
            parse = false;
            html = utils.getTextFromHtml(html, { br: true });
        }
        else if (instance && instance.getType() === 'pre' && !this.editor.isSelectAll()) {
            pre = true;
            clean = false;
            parse = false;
            html = utils.getTextFromHtml(html, { nl: true, trimlines: false, decode: false });
        }
        else if (!this.config.is('paste.clean')) {
            clean = false;
        }

        html = (this.config.is('paste.links')) ? html : remover.removeTags(html, ['a']);
        html = (this.config.is('paste.images')) ? html : remover.removeTags(html, ['img']);

        // empty
        if (html === '') {
            this.event.setPasteEvent(false);
            return;
        }

        // local images
        if (rtf) {
            const images = this._findLocalImages(html);
            html = this._replaceLocalImages(html, images, this._extractImagesFromRtf(rtf));
        }

        // autoparse
        html = (clean) ? autoparse.format(html) : html;

        // replace newlines to br
        if (!isPlainHtml && isPlainText && !pre) {
            html = html.replace(/\n/g, '<br>');
        }

        // paste parsing
        if (parse) {
            html = this._convertMarkdownToHtml(html);
        }

        // insert
        const caret = this.app.editor.isSelectAll() ? 'end' : false;
        const inserted = insertion.insert({ type: 'paste', html, clean, parse, caret });

        // upload inserted base64 or blob
        if (this.config.is('image.upload')) {
            this.image.parseInserted(inserted);
        }

        // placeholder
        this.placeholder.toggle();

        // broadcast
        this.app.broadcast('editor.paste', inserted);
        this.event.setPasteEvent(false);
    }

    handleCopy(e) {
        this._handleClipboardAction(e, 'copy');
    }

    handleCut(e) {
        this._handleClipboardAction(e, 'cut');
    }

    // Private methods

    _convertMarkdownToHtml(html) {
        return html.replace(/(?:^|\n|<br\s*\/?>)(\s*-\s+.+(?:\n|<br\s*\/?>)*)/gi, (match) => {
            const lines = match.split(/(?:\n|<br\s*\/?>)/);
            const listItems = lines
                .filter(line => line.trim().startsWith('-'))
                .map(line => {
                    const content = line.replace(/^\s*-\s+/, '').trim();
                    return content ? `<li>${content}</li>` : '';
                })
                .join('');

            return listItems ? `<ul>${listItems}</ul>` : match;
        });
    }

    _handleImagePaste(e, data) {
        const imageInserted = this.image.insertFromClipboard(e, data);
        return this.config.is('image') && this.config.is('image.upload') && imageInserted;
    }

    _handleClipboardAction(e, name) {
        const clipboard = new Clipboard(this.app);
        const selection = new TextRange(this.app);
        const instance = this.block.get();
        let obj = {}

        // do nothing
        if (instance && instance.isEditable() && selection.isCollapsed()) {
            return;
        }

        // stop event
        e.preventDefault();

        // all selected
        if (this.editor.isSelectAll()) {
            const nodes = this.editor.getLayout().children();
            let content = this.editor.getLayout().html();
            if (nodes.length === 1 && nodes.eq(0).get().tagName === 'P') {
                content = nodes.eq(0).html();
            }

            obj = { html: content, remove: 'all' };
        }
        // multiple selection
        else if (this.blocks.is()) {
            obj = { html: selection.getHtml(), remove: 'content' };
        }
        // single editable
        else if (instance && instance.isEditable()) {
            obj = this._copyFromEditable(name, instance, selection);
        }
        // single non editable
        else if (instance) {
            obj = this._copyFromNonEditable(name, instance);
        }

        // broadcast
        const event = this.app.broadcast('editor.before.' + name, { e: e, html: obj.html });
        if (event.isStopped()) {
            return;
        }

        // delete content
        if (name === 'cut') {
            this._cutDeleteContent(obj, selection);
        }

        // Get html & text and decode
        const encoder = new CleanerEncoder(this.app);
        const utils = new Utils(this.app);

        let html = event.get('html');
        let text = utils.getTextFromHtml(html, { nl: true });

        // set to clipboard
        clipboard.setContent(e, html, text);

        // broadcast
        return this.app.broadcastHtml('editor.' + name, html);
    }

    _cutDeleteContent(obj, selection) {
        this.context.close();

        if (obj.remove === 'instance') {
            obj.instance.remove({ broadcast: true, traverse: true });
        } else if (obj.remove === 'all') {
            this.editor.setEmpty();
        } else if (obj.remove !== false) {
            selection.truncate();
        }

        if (obj.remove !== 'all' && this.app.editor.isEmpty()) {
            this.editor.setEmpty();
        }
    }

    _copyFromEditable(name, instance, selection) {
        const type = instance.getType();
        let html = selection.getHtml();
        let remove = 'content';

        if (type === 'figcaption' || type === 'cell' || type === 'paragraph') {
            remove = 'content';
        }
        else if (instance.isAllSelected()) {
            html = instance.getHtml();
            remove = 'instance';
        }
        else if (type === 'list') {
            var tag = instance.getTag();
            // contains li
            html = selection.getHtml();
            if (html.search(/<li/gi) !== -1) {
                // does not have li at start
                if (html.search(/^<li/g) === -1) {
                    html = '<li>' + html + '</li>';
                }

                // wrap to list
                html = '<' + tag + '>' + html + '</' + tag + '>';
            }
        }

        return { html: html, remove: remove, instance: instance };
    }

    _copyFromNonEditable(name, instance) {
        let html = instance.getOuterHtml();
        let remove = (name === 'cut') ? 'instance' : false;

        return { html: html, remove: remove, instance: instance };
    }

    _findLocalImages(html) {
        const utils = new Utils(this.app);
        const images = [];
        utils.wrap(html, function($w) {
            $w.find('img, v\\:imagedata').each(function($node) {
                const src = $node.attr('src');
                const stateSrc = $node.attr('data-state-src');
                if (src?.search(/^file:\/\//) !== -1 || stateSrc?.search(/^file:\/\//) !== -1) {
                    images.push(src || stateSrc);
                }
            });
        });

        return images;
    }

    _extractImagesFromRtf(rtf) {
        if (!rtf) return [];

        const reHeader = /{\\pict[\s\S]+?\\bliptag-?\d+(\\blipupi-?\d+)?({\\\*\\blipuid\s?[\da-fA-F]+)?[\s}]*?/;
        const reImage = new RegExp('(?:(' + reHeader.source + '))([\\da-fA-F\\s]+)\\}', 'g');
        const images = rtf.match(reImage);
        const res = [];

        if (!images) return [];
        for (let i = 0; i < images.length; i++) {
            let type = false;

            if (images[i].indexOf('\\pngblip') !== -1) {
                type = 'image/png';
            } else if (images[i].indexOf('\\jpegblip') !== -1) {
                type = 'image/jpeg';
            }

            if (type) {
                res.push({
                    hex: images[i].replace(reHeader, '').replace(/[^\da-fA-F]/g, ''),
                    type: type
                });
            }
        }

        return res;
    }

    _convertHexToBase64(str) {
        return btoa(str.match(/\w{2}/g).map(function(char) {
            return String.fromCharCode(parseInt(char, 16));
        }).join(''));
    }

    _replaceLocalImages(html, images, sources) {
        if (images.length === sources.length) {
            for (let i = 0; i < images.length; i++) {
                let src = 'data:' + sources[i].type + ';base64,' + this._convertHexToBase64(sources[i].hex);

                const escaped = this._escapeRegExp(images[i]);
                html = html.replace(
                  new RegExp('data-state-src="' + escaped + '"', 'g'),
                  'data-src="' + src + '"'
                );
            }
        }

        return html;
    }

    _escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
class EventData {
    constructor(app, eventName, data = {}) {
        this.app = app;
        this.eventName = eventName;
        this.data = data instanceof EventData ? data.dump() : data;
        this._isStopped = false;
    }

    stop() {
        this._isStopped = true;
    }

    isStopped() {
        return this._isStopped;
    }

    is(...names) {
        return names.some(name => this.data.hasOwnProperty(name));
    }

    has(name) {
        return this.data[name] !== undefined;
    }

    get(name) {
        if (this.data.hasOwnProperty(name)) {
            return this.data[name];
        }
        return null;
    }

    set(name, value) {
        this.data[name] = value;
    }

    dump() {
        return this.data;
    }

    getName() {
        return this.eventName;
    }
}
class EventDropHandler  {
    constructor(app, event) {
        this.app = app;
        this.event = event;
        this.dom = app.dom;
        this.image = app.image;
        this.config = app.config;
        this.observer = app.observer;
        this.editor = app.editor;
        this.block = app.block;
        this.blocks = app.blocks;

        // local
        this.imageDrag = false;
    }

    handleDrop(e) {
        const dt = e.dataTransfer;
        const item = dt.getData('item');
        const draggableItems = this.config.get('draggable');
        const isImageUpload = this.config.is('image') && this.config.is('image.upload');
        const fileUploadEnabled = this.config.get('filelink.upload') && dt.files?.length;

        if (item) {
            this._handleItemDrop(e, draggableItems[item]);
        } else if (isImageUpload && dt.files?.length) {
            e.preventDefault();
            this.image.drop(e, dt);
        } else if (fileUploadEnabled) {
            e.preventDefault();
            this.app.filelink.drop(e, dt);
        } else {
            this._handleHtmlDrop(e, dt);
        }

        this._finalizeDrop();
    }

    // Private methods

    _handleItemDrop(e, html) {
        e.preventDefault();
        html = html || this._getDropItemHtml(e.dataTransfer.getData('item'));
        if (html) {
            this._drop(e, html, 'after', false);
        }
    }

    _handleHtmlDrop(e, dt) {
        let html = dt.getData('text/html').trim() || dt.getData('Text');
        const $dropped = this._drop(e, html);

        if (this.event.isImageDrag() && $dropped.length) {
            const instance = $dropped.dataget('instance');
            instance.change(this.event.getImageDrag(), false);
        }
    }

    _getDropItemHtml(item) {
        return this.dom(`[data-rx-drop-item=${item}]`).html().trim();
    }

    _finalizeDrop() {
        this.event._removeDrag();
        this.event.setImageDrag(false);
        this.observer.setTrigger(true);
        this.editor.setFocus();
    }

    _drop(e, html, position, cleanDrop = true) {
        const insertion = new Insertion(this.app);
        const autoparse = new Autoparse(this.app);
        const utils = new Utils(this.app);

        const target = this._getDropTarget(e.target, position);
        this.block.set(target);

        // drop point
        if (!position) {
            insertion.insertPoint(e);
        }

        let clean = true;
        let parse = true;
        const instance = this.block.get();
        if (instance && instance.isType('pre') && !this.editor.isSelectAll()) {
            clean = false;
            parse = false;
            html = utils.getTextFromHtml(html, { nl: true, trimlines: false });
        }

        if (cleanDrop === false) {
            clean = false;
            html = autoparse.format(html);
        }

        // empty
        if (html === '') {
            return;
        }

        // autoparse
        html = (clean) ? autoparse.format(html) : html;

        // insert
        return insertion.insert({ html: html, clean: clean, parse: parse, position: position });
    }

    _getDropTarget(target, position) {
        const inspector = new ElementInspector(this.app);
        const dropTarget = position === 'after' ? inspector.getFirstLevel(target) : inspector.getDataBlock(target);

        return (dropTarget.length === 0) ? this.blocks.get({ first: true }) : dropTarget;
    }
}
class EventStrategy {
    constructor(app, event) {
        this.app = app;
        this.event = event;
        this.config = app.config;
        this.dom = app.dom;
        this.uuid = app.uuid;
        this.keycodes = app.keycodes;

        // local
        this.eventname = 'rx-events';
        this.isPopupMouseUp = false;
        this.dragoverEvent = false;

        // Initialize utilities
        this.selector = new EventBlockSelector(this.app, this.event);
        this.dropHandler = new EventDropHandler(this.app, this.event);
        this.clipboardHandler = new EventClipboardHandler(this.app, this.event);
    }

    onmouseup(e) {
        setTimeout(() => {
            if (!this.event.isTrigger() || this.event.isToolClick(e) || this.isPopupMouseUp) return;

            // Processing a click inside the editor
            this.selector.handleMouseUp(e);

            // Opening the context menu and observing changes with a minimal delay
            // to allow time for the selection state to update
            this._observeAndContext(e);

            // Updating the buffer state
            this.app.state.add(e);

            // Broadcasting the mouseup event
            this.app.broadcast('editor.mouseup', { e });
        }, 0);
    }

    onmousedown(e) {
        setTimeout(() => {
            if (!this.event.isTrigger() || this.event.isToolClick(e)) return;

            // if selection has started or ended outside block
            this.event.setMouseDown(e);

            if (!this.isPopupMouseUp) {
                this.app.dropdown.close();
            }

            this.app.placeholder.handleClick(e);

            // broadcast
            this.app.broadcast('editor.mousedown', { e: e });
        }, 0);
    }

    ontouchstart(e) {
        if (this.event.isTrigger()) {
            this.app.state.add(e);
        }
    }

    onmouseover(e) {
        if (this.event.isTrigger()) {
            this.app.page.getBody().find('.rx-tooltip').remove();
            this.app.broadcast('editor.mouseover', { e: e });
        }
    }

    onkeyup(e) {
        if (!this.event.isTrigger() || (this.app.dropdown.isOpen() && !this.app.dropdown.isPanel())) return;

        const event = this.app.broadcast('editor.keyup', { e });
        if (event.isStopped()) {
            e.preventDefault();
            return;
        }

        // Catch command
        if (this.config.is('command')) {
            this.app.command.build(e);
        }

        const key = e.which;
        const { DOWN, UP, BACKSPACE, LEFT, RIGHT, ENTER } = this.keycodes;

        // Catch arrow down/up for editable in the middle position
        if ([DOWN, UP].includes(key)) {
            this._handleArrowKeys();
        }

        // Backspace & empty
        if (key === BACKSPACE && this.app.editor.isEmpty()) {
            this.app.editor.setEmpty(false);
        }

        // Observer for arrow keys
        if ([LEFT, RIGHT, DOWN, UP].includes(key)) {
            this.app.observer.observe();
        }

        // Catch enter key and scroll
        if (key === ENTER) {
            this._scrollOnEnter();
        }
    }

    ondrop(e) {
        if (!this.event.isTrigger() || !this.config.is('drop')) {
            return e.preventDefault();
        }

        let event = this.app.broadcast('editor.drop', { e: e });
        if (event.isStopped()) {
            return e.preventDefault();
        }

        this.dropHandler.handleDrop(e);
    }

    ondragstart(e) {
        if (!this.event.isTrigger()) return;

        const $block = this.dom(e.target).closest('[data-rx-first-level]');
        const inspector = new ElementInspector(this.app);
        if ($block.length !== 0 && inspector.isType($block, 'image')) {
            this.event.setImageDrag($block.dataget('instance'));
        }

        this.app.broadcast('editor.dragstart', { e: e });
    }

    ondragover(e) {
        if (!this.event.isTrigger()) return;

        e.preventDefault();
        this.dragoverEvent = true;
        this.app.observer.setTrigger(false);
        this.event._removeDrag();

        if (e.dataTransfer.types.includes('item')) {
            const $block = this.dom(e.target).closest('[data-rx-type]');
            if ($block.length) {
                const $pl = this.dom('<div>').addClass('rx-draggable-placeholder');
                $block.after($pl);
            }
        }

        this.app.broadcast('editor.dragover', { e: e });
    }

    ondragleave(e) {
        if (!this.event.isTrigger()) return;

        e.preventDefault();
        this.dragoverEvent = true;
        this.app.observer.setTrigger(true);
        this.event._removeDrag();

        this.app.broadcast('editor.dragleave', { e: e });
    }

    ondocmousedown(e) {
        if (!this.event.isTrigger()) return;

        this.isPopupMouseUp = !!this.dom(e.target).closest(`.rx-dropdown-${this.uuid}`).length;
        this.app.broadcast('document.mousedown', { e: e });
    }

    onwinfocus() {
        const instance = this.app.block.get();
        if (instance && !instance.isEditable()) {
            setTimeout(() => {
                const selection = new TextRange(this.app);
                selection.remove();
            }, 0);
        }
    }

    // Private methods

    _onfocus(e) {
        if (this.event.isTabFocus() && !this.app.editor.hasFocus()) {
            this.app.editor.setFocus('start');
            this.event.setTabFocus(false);
        }
    }

    _onpaste(e) {
        if (this.event.isEditorFocus()) {
            this.clipboardHandler.handlePaste(e);
        }
    }

    _oncopy(e) {
        if (this.event.isEditorFocus()) {
            this.clipboardHandler.handleCopy(e);
        }
    }

    _oncut(e) {
        if (this.event.isEditorFocus()) {
            this.clipboardHandler.handleCut(e);
        }
    }

    _onkeydown(e) {
        if (!this._shouldHandleKeyEvent()) return;

        let event = this.app.broadcast('editor.keydown', { e: e });
        if (event.isStopped()) {
            return e.preventDefault();
        }

        const key = e.key;
        const selection = new TextRange(this.app);

        if (this.event.checkPanelKeys(e)) return;
        if (this._handleInlineCaretMove(e, key, selection)) return;
        if (this._handleEscapeKey(e, key, selection)) return;

        // context
        this.app.context.close();

        if (this._handleEnterKey(e, key)) return;
        if (this.app.state.listen(e)) return;
        if (this.app.hotkeys.handle(e)) return;
        if (this.event.isToolClick(e)) return;

        this.app.input.handle(event);
    }

    _onclick(e) {
        if (!this.event.isTrigger()) return;

        this.app.broadcast('editor.click', { e: e });

        if (e.detail === 2 && !this.event.isToolClick(e)) {
            setTimeout(() => {
                this.event.setDoubleClick(true);
                this.selector.setByClick(e);
            }, 0);
        }

        if (e.detail === 3 && !this.event.isToolClick(e)) {
            setTimeout(() => {
                this.event.setTripleClick(true);
                this.selector.setByClick(e);
            }, 0);
        }
    }

    _ondockeydown(e) {
        if (!this.event.isTrigger() || this.app.block.isTool()) return;

        this.app.broadcast('document.before.keydown', { e: e });
        this.event.checkTabFocus(e);

        if (e.key === 'Escape') this.event.checkPopupsOpen(e);
        if (this.event.checkPanelKeys(e) || this.event.isOutsideEditor(e)) {
            return;
        }
        this.app.broadcast('document.keydown', { e: e });
    }

    _observeAndContext(e) {
        setTimeout(() => {
            this.app.context.open();
            this.app.observer.observe();

            // Resetting the block mouse down state
            this.event.setMouseDown(false);
            this.event.setTripleClick(false);
        }, 1);
    }

    _shouldHandleKeyEvent() {
        if (!this.event.isTrigger() || this.app.dropdown.isOpen() || this.app.source.is() || !this.app.editor.hasFocus()) {
            return false;
        }

        return true;
    }

    _handleInlineCaretMove(e, key, selection) {
        const caret = new Caret(this.app);
        const inline = selection.getInline();

        if (inline && caret.is(inline, 'end') && key === 'ArrowRight' && inline.style.display !== 'block') {
            e.preventDefault();
            caret.set(inline, 'after');
            return true;
        }
        return false;
    }

    _handleEnterKey(e, key) {
        if (!this.config.is('enterKey') && key === 'Enter') {
            e.preventDefault();
            return true;
        }
        return false;
    }

    _handleEscapeKey(e, key, selection) {
        if (key === 'Escape' && this.app.context.isOpen()) {
            e.preventDefault();
            selection.collapse();
            this.app.context.close();

            if (this.app.blocks.is()) {
                const first = this.app.blocks.get({ selected: true, first: true, instances: true })
                this.app.blocks.unset();
                this.app.block.set(first);
            }
            return true;
        }

        if (key === 'Escape') {
            this.app.block.unset();
            this.app.blocks.unset();
            selection.remove();
        }

        return false;
    }

    _handleArrowKeys() {
        const selection = new TextRange(this.app);
        const block = selection.getBlockControlled();
        if (block && !this.app.block.is(block)) {
            this.app.block.set(block);
        }
    }

    _scrollOnEnter() {
        setTimeout(() => {
            const inspector = new ElementInspector(this.app);
            const blocks = this.app.block.get();
            if (!blocks) return;

            const block = blocks.getBlock();
            const isVisible = inspector.isElementVisibleInScroll(block);
            const container = this.app.editor.getEditor().get();

            if (!isVisible) {
                container.scrollTo({
                    top: container.scrollHeight - container.clientHeight,
                    behavior: 'smooth'
                });
            }
        }, 10);
    }

    _bindEvents($target, events, type) {
        events.forEach(event => {
            $target.on(`${event}.${this.eventname}`, e => {
                const handlerName = `on${type}${event}`;
                if (typeof this[handlerName] === 'function') {
                    this[handlerName](e);
                }
            });
        });
    }

    _unbindEvent(...targets) {
        targets.forEach(target => target.off('.' + this.eventname));
    }
}
class IframeEventStrategy extends EventStrategy {
    start() {
        this.events = {
            body: ['click', 'touchstart', 'mouseover', 'mouseup', 'mousedown', 'keydown', 'keyup',
                    'paste', 'copy', 'cut', 'drop', 'dragstart', 'dragover', 'dragleave'],
            doc: ['keydown', 'mousedown', 'mouseup', 'click'],
            win: ['focus'],
            frame: ['click'],
            layout: ['focus']
        };

        this._bindEvents(this.app.page.getFrameBody(), this.events.body, '');
        this._bindEvents(this.app.page.getWin(), this.events.win, 'win');
        this._bindEvents(this.app.page.getFrameDoc(), this.events.frame, 'frame');
        this._bindEvents(this.app.page.getDoc(false), this.events.doc, 'doc');
        this._bindEvents(this.app.editor.getLayout(), this.events.layout, 'layout');
    }

    stop() {
        this._unbindEvent(this.app.page.getFrameBody(), this.app.page.getWin(), this.app.page.getFrameDoc(), this.app.page.getDoc(), this.app.editor.getLayout());
    }

    onclick(e) {
        this._onclick(e);
    }

    onkeydown(e) {
        return this._onkeydown(e);
    }

    onpaste(e) {
        return this._onpaste(e);
    }

    oncopy(e) {
        return this._oncopy(e);
    }

    oncut(e) {
        return this._oncut(e);
    }

    ondocclick(e) {
        if (!this.event.isTrigger() || this.event.isToolClick(e)) return;
        if (this.event.isOutsideEditor(e) && !this.event.isMouseDown()) {
            this.event.checkPopupsOpen(e);
        }

        this.app.broadcast('document.click', { e: e });
    }

    ondockeydown(e) {
        return this._ondockeydown(e);
    }

    ondocmouseup(e) {
        if (this.isPopupMouseUp) return;

        if (this.event.isOutsideEditor(e)) {
            this.app.editor.setBlur();
            this.app.broadcast('document.mouseup', { e: e });
        }
    }

    onframeclick(e) {
        if (!this.event.isTrigger()) return;
        if (e.target.tagName === 'HTML') {
            this.selector.setByClick(e);
        }
    }

    onlayoutfocus(e) {
        return this._onfocus(e);
    }
}
class NormalEventStrategy extends EventStrategy {
    start() {
        this.events = {
            editor: ['click', 'touchstart', 'mouseover', 'mouseup', 'mousedown', 'keyup', 'keydown',
                     'drop', 'dragstart', 'dragover', 'dragleave', 'focus'],
            doc: ['keydown', 'mousedown', 'mouseup', 'click', 'paste', 'cut', 'copy'],
            win: ['focus']
        };

        this._bindEvents(this.app.editor.getEditor(), this.events.editor, '');
        this._bindEvents(this.app.page.getDoc(), this.events.doc, 'doc');
        this._bindEvents(this.app.page.getWin(), this.events.win, 'win');
    }

    stop() {
        this._unbindEvent(this.app.editor.getEditor(), this.app.page.getDoc(), this.app.page.getWin());
    }

    onfocus(e) {
        return this._onfocus(e);
    }

    onclick(e) {
        return this._onclick(e);
    }

    onkeydown(e) {
        return this._onkeydown(e);
    }

    ondocpaste(e) {
        return this._onpaste(e);
    }

    ondoccopy(e) {
        return this._oncopy(e);
    }

    ondoccut(e) {
        return this._oncut(e);
    }

    ondocclick(e) {
        if (!this.event.isTrigger() || this.event.isToolClick(e) || this.isPopupMouseUp) return;
        if (this.event.isOutsideEditor(e) && !this.event.isMouseDown()) {
            this.event.checkPopupsOpen(e);
            this.app.editor.setBlur(e);
        }

        this.app.broadcast('document.click', { e: e });
    }

    ondockeydown(e) {
        return this._ondockeydown(e);
    }

    ondocmouseup(e) {
        if (this.event.isOutsideEditor(e)) {
            setTimeout(() => {
                if (this.event.isMouseDown()) {
                    this.selector.handleMouseUp(e);

                    // Opening the context menu and observing changes with a minimal delay
                    // to allow time for the selection state to update
                    this._observeAndContext(e);
                }

                this.app.broadcast('document.mouseup', { e: e });
            }, 2);
        }
    }
}
/*jshint esversion: 6 */
class UIManager {
    constructor(app) {
        this.app  = app;

        this.register = {};
        this.containers = {};
        this.buttonsCustom = {};
        this.buttonsRemove = {};
        this.buttonsBlockSpecific = {};
        this.state = {
            type: false,
            button: false,
            instance: false
        };
    }

    stop() {
        this.closeTooltip();
    }
    closeTooltip() {
        this.app.$body.find('.rx-tooltip').remove();
    }
    close(e, ...contexts) {
        if (e && !e.preventDefault) {
            contexts.unshift(e);
            e = null;
        }

        const validContexts = this._handleContexts(contexts, ['dropdown', 'control', 'context']);
        validContexts.forEach(context => this.app[context].close(e));
    }
    unset(...contexts) {
        const validContexts = this._handleContexts(contexts, ['toolbar', 'extrabar', 'context']);
        validContexts.forEach(context => this.app[context].unsetActive());
    }
    disable(...contexts) {
        let allContexts = ['path', 'extrabar', 'statusbar', 'toolbar'];
        if (this.app.isReadonly()) {
            const readonly = this.config.get('readonly');
            if (typeof readonly === 'object') {
                allContexts = allContexts.filter(context => !readonly.hasOwnProperty(context));
            }
        }

        const validContexts = this._handleContexts(contexts, allContexts);
        validContexts.forEach(context => this.app[context].disable());
    }
    disableToolbar(type, name) {
        this._findButtons(type).each($btn => this._enableDisable($btn, name, true));
    }
    enable(...contexts) {
        const validContexts = this._handleContexts(contexts, ['path', 'extrabar', 'statusbar', 'toolbar']);
        validContexts.forEach(context => this.app[context].enable());
    }
    enableToolbar(type, name) {
        this._findButtons(type).each($btn => this._enableDisable($btn, name, false));
    }
    _enableDisable($btn, name, type) {
        if (name.length > 0) {
            let btnName = $btn.data('name');
            if (name.includes(btnName)) {
                $btn.dataget('instance').setState({ disabled: type });
            }
        }
        else {
            $btn.dataget('instance').setState({ disabled: type });
        }
    }
    isAnyOpen(...contexts) {
        return contexts.some(context => this.app[context] && this.app[context].isOpen());
    }
    updateTheme(theme) {
        const contexts = ['tooltip', 'control', 'context'];
        const popups = ['dropdown'];

        contexts.forEach(context => this.app.$body.find(`.rx-${context}`).attr('rx-data-theme', theme));
        popups.forEach(popup => this.app.$body.find(`.rx-${popup}-` + this.uuid).each($node => $node.attr('rx-data-theme', theme)));
    }
    updatePosition(...contexts) {
        contexts.forEach(context => this.app[context].updatePosition());
    }
    updateEvents(...contexts) {
        contexts.forEach(context => this.app[context].updateEvents());
    }
    observeButtons($container) {
        $container.find('.rx-button').each($node => $node.dataget('instance')?.observe());
    }
    loadToolbar(type, currentType) {
        let instance = this.app.block.get();
        let instanceType = (instance) ? instance.getType() : false;

        if (currentType !== instanceType) {
            currentType = this.buildButtons(type);
            this.loadBlockButtons(type);
        }
        else {
            this.observeButtons(this.getContainer(type));
        }

        return currentType;
    }
    loadBlockButtons(type) {
        this.buildBlockButtons(type, this.getContainer(type));
    }
    build(type, $container) {
        return new UIBuilder(this, type, $container);
    }
    loadButtonsFromArray(buttons, customButtons, type, removeButtons) {
        buttons = this._buildButtonObj(type, buttons);
        customButtons = this._buildButtonObj(type, customButtons);

        // make result
        return this._makeButtons(type, false, buttons, customButtons, removeButtons);
    }
    loadButtons(buttons, customButtons, type, $container, removeButtons) {
        buttons = this._buildButtonObj(type, buttons);
        customButtons = this._buildButtonObj(type, customButtons);

        // make result
        const toggled = this._getToggledButtons($container);
        const result = this._makeButtons(type, $container, buttons, customButtons, removeButtons);

        // clear container
        if ($container) {
            $container.html('');
        }

        return this._createButtons(result, toggled, type, $container);
    }
    buildButtons(type, blockInstance, noAddingCustom) {
        const buttons = noAddingCustom ? [] : this._getButtonsFromconfig(type, blockInstance);
        const customButtons = this._getCustomButtons(type, blockInstance, noAddingCustom);
        const removeButtons = (type === 'control') ? [] : this.getButtonsRemove(type);
        const $container = this.getContainer(type);
        const toggled = this._getToggledButtons($container);
        const result = this._makeButtons(type, $container, buttons, customButtons, removeButtons, noAddingCustom);

        // clear container
        if ($container || type === 'context' && blockInstance) {
            $container.html('');
        }

        this._createButtons(result, toggled, type, $container);

        // buttons order
        this._buildButtonsOrder(type, $container);

        let instance = this.app.block.get();
        return (instance) ? instance.getType() : false;
    }
    buildBlockButtonsGetter(type, removeButtons = []) {
        const block = this.app.block.get();
        if (!block) return;

        const result = {};
        const buttons = block.getButtons(type) || {};
        Object.entries(buttons).forEach(([key, item]) => {
            const obj = this._buildObject(type, key, item);
            if (!removeButtons.includes(key) && !this._isHiddenButton(type, key)) {
                result[key] = obj;
            }
        });

        return result;
    }
    buildBlockButtons(type, $container, removeButtons = []) {
        const block = this.app.block.get();
        if (!block) return;

        const buttons = block.getButtons(type) || {};
        Object.entries(buttons).forEach(([key, item]) => {
            const obj = this._buildObject(type, key, item);
            if (!removeButtons.includes(key) && !this._isHiddenButton(type, key)) {
                const button = new Button(this.app, key, obj, type, $container);
            }
        });
    }
    buildDepth(type, $container) {
        let index = '';
        let isPopup = ['dropdown'].includes(type);
        if (this.config.is('bsmodal')) {
            index = (isPopup) ? 1061 : 1060;
        } else if (this.app.isProp('fullscreen')) {
            index = (isPopup) ? 10002 : 10001;
        }

        $container.css('z-index', index);
    }
    getContainer(name) {
        return this.containers[name] ??= this.dom([]);
    }
    getButtonsCustom(type) {
        return this.buttonsCustom[type] ??= {};
    }
    getButtonsBlockSpecific(type) {
        return this.buttonsBlockSpecific[type] ??= {};
    }
    getButtonsRemove(type) {
        return this.buttonsRemove[type] ??= [];
    }
    addContainer(name, $el) {
        this.containers[name] = $el;
    }
    registerButton(name, obj) {
        this.register[name] = obj;
    }
    addButton(type, name, obj, block) {
        if (this.app.isStarted()) {
            let btnObj = this._buildObject(type, name, obj);
            const button = new Button(this.app, name, btnObj, type, this.getContainer(type));
        } else {
            if (block) {
                this.buttonsBlockSpecific[type] ??= {};
                this.buttonsBlockSpecific[type][name] = obj;
            } else {
                this.buttonsCustom[type] ??= {};
                this.buttonsCustom[type][name] = obj;
            }
            this.registerButton(name, obj);
        }
    }
    removeButton(type, name) {
        this.buttonsRemove[type] ??= [];
        if (Array.isArray(name)) {
            this.buttonsRemove[type].push(...name);
        } else {
            this.buttonsRemove[type].push(name);
        }
    }
    setButton() {

    }
    setButtonColor($node, styles) {
        const instance = $node.dataget('instance');
        if (instance && !instance.getProp('color')) return;

        if (styles && Object.keys(styles).length) {
            const { color, background } = styles;
            if (color && background) {
                instance.setBackground(background);
                instance.setColor(color);
            } else {
                instance.setBackground(color || background);
            }
        } else {
            instance.resetBackground();
        }
    }
    setState(state) {
        let prevState = this.state;
        this.state = state;
        if (prevState) {
            this.state.prev = prevState;
        }
    }
    setActive(type, name) {
        this.unsetActive(type);
        this._findButtonInstance(type, name)?.setState({ active: true });
    }
    setActiveKeys(contexts, keys, styles) {
        contexts.forEach(context => this._setButtonsActiveByKeys(context, keys));
        contexts.forEach(context => this._setButtonsStyle(context, styles));
    }
    setToggled(type, name) {
        this.unsetToggled(type);
        this._findButtonInstance(type, name)?.setState({ pressed: true });
    }
    getState() {
        return this.state;
    }
    getButton(type, name) {
        return this._findButtonInstance(type, name);
    }
    unsetActive(type, name) {
        if (name) {
            let btn = this._findButtonInstance(type, name);
            if (btn) {
                btn.setState({ active: false });
            }
        }
        else {
            this._findButtons(type).each($btn => {
                $btn.dataget('instance').setState({ active: false });
                $btn.dataget('instance').resetBackground();
            });
        }
    }
    unsetToggled(type, name, except) {
        if (name) {
            let btn = this._findButtonInstance(type, name);
            if (btn) {
                btn.setState({ pressed: false });
            }
        }
        else {
            this._findButtons(type).each($btn => {
                let button = $btn.dataget('instance');
                button.setState({ pressed: false });

                if (!except || (except && button.getName() !== except)) {
                    $btn.removeClass('rx-in-modal');
                }
            });
        }
    }

    // Private methods

    _handleContexts(contexts, defaultContexts) {
        return (contexts.length === 0) ? defaultContexts : contexts;
    }
    _setButtonsActiveByKeys(type, keys) {
        keys.forEach(key => this._findButtonInstance(type, key)?.setState({ active: true }));
    }
    _setButtonsStyle(type, styles) {
        this._findButtons(type).each($node => this.setButtonColor($node, styles));
    }
    _findButton(type, name) {
        return this.getContainer(type).find('[data-name=' + name + ']');
    }
    _findButtonInstance(type, name) {
        let $btn = this._findButton(type, name);
        if ($btn.length !== 0) {
            return $btn.dataget('instance');
        }
    }
    _findButtons(type) {
        return this.getContainer(type).find('.rx-button');
    }
    _makeButtons(type, $container, buttons, customButtons, removeButtons, noAddingCustom) {
        const extendFromconfig = noAddingCustom ? [] : this._getExtendFromconfig(type);
        const blockButtons = this._getBlockButtons(type);

        if (type === 'dropdown' && this.app.dropdown.getName() === 'control') {
            type = 'control';
        }

        const removeButtonsconfig = this.config.get(`${type}.hide`) || [];

        // make result
        let result = [...buttons, ...customButtons, ...extendFromconfig, ...blockButtons];
        let resultRemove = [...removeButtons, ...removeButtonsconfig];
        result = this._shiftLastPositionButtons(result);

        // filter & remove buttons
        return result.filter(button => !resultRemove.includes(button.name));
    }
    _buildButtonsOrder(type, $container) {
        const buttons = this._findButtons(type).all();
        const fragment = document.createDocumentFragment();
        const order = this.config.get('buttons.' + type);
        const initialOrder = Redactor.opts.buttons[type];
        if (order && initialOrder !== order) {
            order.forEach(name => {
                const button = buttons.find(btn => btn.getAttribute("data-name") === name);
                if (button) {
                    fragment.appendChild(button);
                }
            });
            buttons.forEach(button => {
                if (!order.includes(button.getAttribute("data-name"))) {
                    fragment.appendChild(button);
                }
            });
            $container.html('');
            $container.append(fragment);
        }
    }
    _buildObject(type, name, extend) {
        let btnObj = this._getButtonObj(name);
        btnObj = btnObj ? Redactor.extend(true, {}, btnObj, extend) : Redactor.extend(true, {}, extend);
        btnObj.name = btnObj.name !== undefined ? btnObj.name : name;
        return this._isHiddenButton(type, name) ? false : btnObj;
    }
    _buildButtonObj(type, buttons) {
        let result = [];
        if (Array.isArray(buttons)) {
            buttons.forEach(name => {
                let extend = {};
                if (typeof name === 'object') {
                    extend = name;
                    name = name.name;
                }
                const obj = this._buildObject(type, name, extend);
                if (obj) result.push(obj);
            });
        } else {
            Object.entries(buttons).forEach(([name, item]) => {
                const obj = this._buildObject(type, name, item);
                if (obj) result.push(obj);
            });
        }

        return result;
    }
    _shiftLastPositionButtons(buttons) {
        const lastItemIndex = buttons.findIndex(button => button.position === 'last');
        if (lastItemIndex !== -1) {
            const [lastItem] = buttons.splice(lastItemIndex, 1);
            buttons.push(lastItem);
        }
        return buttons;
    }
    _getButtonsFromconfig(type, blockInstance) {
        let buttons = [...this.config.get('buttons.' + type)];
        if (type === 'context' && blockInstance) {
            buttons = [];
        }
        return this._buildButtonObj(type, buttons);
    }
    _getCustomButtons(type, blockInstance, noAddingCustom) {
        let buttons = (type === 'control') ? {} : this.getButtonsCustom(type);
        buttons = noAddingCustom ? {} : buttons;
        if (type === 'context' && blockInstance) {
            buttons = this.getButtonsBlockSpecific(type);
        }
        return this._buildButtonObj(type, buttons);
    }
    _getExtendFromconfig(type) {
        const buttons = this.config.get(`${type}.add`) || {};
        return this._buildButtonObj(type, buttons);
    }
    _getBlockButtons(type) {
        const block = this.app.block.get();
        const buttons = (type === 'control') ? {} : block ? block.getButtons(type) || {} : {};
        return this._buildButtonObj(type, buttons);
    }
    _getToggledButtons($container) {
        const toggled = {};
        if ($container) {
            $container.find('.pressed').each($node => {
                const btn = $node.dataget('instance');
                if (btn) {
                    toggled[btn.getName()] = {
                        title: btn.getTitle(),
                        icon: btn.getIcon(),
                        command: btn.getCommand()
                    };
                }
            });
        }
        return toggled;
    }
    _createButtons(buttons, toggled, type, $container) {
        const stack = {};

        buttons.forEach(item => {
            const button = new Button(this.app, item.name, item, type, $container);
            stack[item.name] = button;

            if (toggled[item.name]) {
                button.setState({ pressed: true });
                button.setIcon(toggled[item.name].icon);
                button.setCommand(toggled[item.name].command);
                button.setTitle(toggled[item.name].title);
            }
        });

        return stack;
    }
    _isHiddenButton(type, name) {
        const instance = this.app.block.get();
        const map = {
            'add': 'addbar',
            'html': 'source',
            'format': 'format',
            'line': 'line',
            'pre': 'pre',
            'quote': 'quote',
            'layout': 'layouts',
            'wrapper': 'wrapper',
            'table': 'table',
            'image': 'image',
            'todo': 'todo'
        };

        if (map[name] !== undefined && !this.config.is(map[name])) return true;
        if (name === 'trash' && instance && instance.isType('noneditable') && !this.config.is('noneditable.remove')) return true;
        if (name === 'trash' && instance && instance.isNondeletable()) return true;
        if ((name === 'trash' || name === 'duplicate') && instance && instance.isType('column')) return true;

        return false;
    }
    _getButtonObj(name) {
        const buttons = this.config.get('buttonsObj');
        let obj = buttons[name] ? buttons[name] : false;
        obj = !obj && this.app.ui.register[name] ? this.app.ui.register[name] : obj;

        return obj;
    }
}
/*jshint esversion: 6 */
class UIBuilder {
    constructor(ui, type, $container) {
        this.ui = ui;
        this.type = type;
        this.uuid = ui.uuid;
        this.$container = $container;

        this.build();
    }
    build() {
        this.$toolbar = new Dom('<div>').addClass('rx-' + this.type + ' rx-' + this.type + '-' + this.uuid);
        this.$toolbarButtons = new Dom('<div>').addClass('rx-' + this.type + '-buttons');
        this.$toolbarLine = new Dom('<div>').addClass('rx-' + this.type + '-line').hide();

        this.$toolbar.append(this.$toolbarButtons);
        if (this.type === 'context') this.$toolbar.append(this.$toolbarLine);
        this.$container.append(this.$toolbar);

        this.ui.addContainer(this.type, this.$toolbarButtons);
    }
    getElement() {
        return this.$toolbar;
    }
    getElementLine() {
        return this.$toolbarLine;
    }
}
class UIForm {
    constructor(app, params) {
        this.app = app;
        this.dom = app.dom;
        this.loc = app.loc;

        // local
        this.tools = {};
        this.data = false;

        this.app.broadcast('form.before.create', { params });
        this.create(params);
    }

    // @deprecated 5.0 - move to constructor
    create(params) {
        const defaults = {
            title: false,
            data: false,
            width: false,
            items: false,
            focus: false,
            setter: false,
            getter: false,
            command: false

        };

        this.params = { ...defaults, ...params };
        this.data = this.params.data;

        this._build();
    }

    setFocus(name) {
        this._buildFocus(name);
    }

    setSetter(setterName) {
        this.params.setter = setterName;
    }

    setData(data) {
        this.data = data;
    }

    getSetter() {
        return this.params.setter;
    }

    getCommand() {
        return this.params.command;
    }

    getElement() {
        return this.$form;
    }

    getItem(name) {
        let tool = this.getTool(name);

        return (tool) ? tool.getInput().closest('.rx-form-item') : this.dom();
    }

    getInput(name) {
        let tool = this.getTool(name);
        return (tool) ? tool.getInput() : this.dom();
    }

    getTool(name) {
        return (typeof this.tools[name] !== 'undefined') ? this.tools[name] : false;
    }

    getData(name) {
        let data;
        if (name) {
            if (typeof this.tools[name] !== 'undefined') {
                data = this.tools[name].getValue();
            }
        }
        else {
            data = {};
            Object.keys(this.tools).forEach(function(key) {
                data[key] = this.tools[key].getValue();
            }.bind(this));
        }

        return data;
    }

    // Private methods

    _build() {
        this.$form = this.dom('<div>').addClass('rx-form');

        this._buildWidth();
        this._buildTitle();
        this._buildData();
        this._buildForm();
        this._buildFocus();

        this.app.broadcast('form.create', { form: this, params: this.params});
    }

    _buildWidth() {
        if (this.params.width) {
            this.$form.css('width', this.params.width);
        }
    }

    _buildData() {
        if (!this.data) {
            this.data = (this.params.getter) ? this.app.api(this.params.getter, this) : false;
        }
    }

    _buildFocus(name) {
        name = name || this.params.focus;
        if (name) {
            if (typeof this.tools[name] !== 'undefined') {
                this.tools[name].setFocus();
            } else {
                const $input = this.$form.find('input').first();
                if ($input.length) {
                    $input.focus();
                }

            }
        }
    }

    _buildTitle() {
        if (!this.params.title) return;

        this.$title = this.dom('<div>').addClass('rx-form-title');
        this.$title.html(this.loc.parse(this.params.title));

        this.$form.append(this.$title);
    }

    _buildForm() {
        this._renderTools();
        this._renderData();

        // enter events
        this.$form.find('input[type=text],input[type=url],input[type=email]').on('keydown.rx-form', function(e) {
            if (e.which === 13) {
                e.preventDefault();
                return false;
            }
        }.bind(this));
    }

    _renderTools() {
        const flexTypes = ['flex', 'flex2', 'flex3'];
        for (let [key, item] of Object.entries(this.params.items)) {

            if (item.title) {
                let $title = this.dom('<div class="rx-form-section">');
                $title.html(this.loc.parse(item.title));
                this.$form.append($title);
                continue;
            }

            if (flexTypes.includes(key)) {
                let $target = this.dom('<div class="rx-form-flex">');
                this.$form.append($target);
                for (let [name, val] of Object.entries(item)) {
                    this._renderTool(name, val, $target);
                }
            }
            else {
                this._renderTool(key, item, this.$form);
            }
        }
    }

    _renderTool(name, obj, $target) {
        if (!obj.type) return;

        const toolName = this._getToolClassName(obj);
        const tool = new Redactor[toolName](this.app, name, obj, this);

        let $tool = tool.getElement();
        if ($tool) {
            this.tools[name] = tool;
            $target.append($tool);
        }
    }

    _renderData() {
        if (!this.data) return;
        for (let name in this.data) {
            if (typeof this.tools[name] !== 'undefined') {
                this.tools[name].setValue(this.data[name]);
            }
        }
    }

    _getToolClassName(obj) {
        return 'Tool' + obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
    }
}

Redactor.UIForm = UIForm;
/*jshint esversion: 6 */
class ToolBar {
    constructor(app) {
        this.app = app;
    }

    init() {
        if (!this.isEnabled()) return;

        this.$toolbox = this.app.container.get('toolbox');
        this._buildToolbar();
        this._buildRaised();
        this._buildSticky();
    }

    stop() {
        if (!this.isEnabled()) return;
        this.$toolbar.remove();
    }

    load() {
        this.build();
    }

    build() {
        if (!this.isEnabled()) return;
        this.app.ui.buildButtons('toolbar');
    }

    add(name, obj) {
        this.app.ui.addButton('toolbar', name, obj);
    }

    remove(name) {
        this.app.ui.removeButton('toolbar', name);
    }

    setActive(name) {
        this.app.ui.setActive('toolbar', name);
    }

    setToggled(name) {
        this.app.ui.setToggled('toolbar', name);
    }

    unsetActive(name) {
        this.app.ui.unsetActive('toolbar', name);
    }

    unsetToggled(name, except) {
        this.app.ui.unsetToggled('toolbar', name, except);
    }

    getButton(name) {
        return this.app.ui.getButton('toolbar', name);
    }

    getElement() {
        return this.$toolbar;
    }

    enable(...name) {
        this.enableSticky();
        this.app.ui.enableToolbar('toolbar', name);
    }

    disable(...name) {
        this.disableSticky();
        this.app.ui.disableToolbar('toolbar', name);
    }

    enableSticky() {
        if (!this.isEnabled()) return;
        this.sticky.enableSticky();
    }

    disableSticky() {
        if (!this.isEnabled()) return;
        this.sticky.disableSticky();
    }

    isSticky() {
        return this.sticky.isSticky();
    }

    isEnabled() {
        return this.config.is('toolbar');
    }

    isRaised() {
        return this.config.is('toolbar.raised');
    }

    isExternal() {
        return this.config.is('toolbar.target');
    }

    rebuildSticky() {
        this.sticky.observeSticky();
    }

    // private
    _buildToolbar() {
        const toolbarContainer = this.app.container.get('toolbar');
        this.$toolbar = this.app.ui.build('toolbar', toolbarContainer).getElement();
    }

    _buildSticky() {
        this.sticky = new ToolBarSticky(this.app, this);
        this.sticky.enableSticky();
    }

    _buildRaised() {
        if (this.config.is('toolbar.raised')) {
            this.$toolbox.addClass('rx-raised');
        }
    }
}
/*jshint esversion: 6 */
class ExtraBar {
    constructor(app) {
        this.app = app;

        this.eventname = 'rx-toolbar';
    }

    init() {
        if (!this.isEnabled()) return;
        this._buildToolbar();
    }

    stop() {
        if (!this.isEnabled()) return;
        this.$toolbar.remove();
    }

    load() {
        this.build();
    }

    build() {
        if (!this.isEnabled()) return;
        this.app.ui.buildButtons('extrabar');
    }

    add(name, obj) {
        this.app.ui.addButton('extrabar', name, obj);
    }

    remove(name) {
        this.app.ui.removeButton('extrabar', name);
    }

    setActive(name) {
        this.app.ui.setActive('extrabar', name);
    }

    setToggled(name) {
        this.app.ui.setToggled('extrabar', name);
    }

    unsetActive(name) {
        this.app.ui.unsetActive('extrabar', name);
    }

    unsetToggled(name, except) {
        this.app.ui.unsetToggled('extrabar', name, except);
    }

    getButton(name) {
        return this.app.ui.getButton('extrabar', name);
    }

    getElement() {
        return this.$toolbar;
    }

    enable(...name) {
        this.app.ui.enableToolbar('extrabar', name);
    }

    disable(...name) {
        this.app.ui.disableToolbar('extrabar', name);
    }

    isEnabled() {
        return this.config.is('extrabar');
    }

    // =private
    _buildToolbar() {
        const toolbarContainer = this.app.container.get('toolbar');
        this.$toolbar = this.app.ui.build('extrabar', toolbarContainer).getElement();
    }
}
/*jshint esversion: 6 */
class ToolBarSticky {
    constructor(app, toolbar) {
        this.toolbar = toolbar;
        this.app = app;
        this.config = app.config;
        this.eventname = 'rx-toolbar';
        this.$toolbox = this.app.container.get('toolbox');
    }

    isSticky() {
        let $main = this.app.container.get('main');
        let raisedTolerance = (this.toolbar.isRaised()) ? parseInt(this.$toolbox.css('margin-top')) : 0;
        let mainTop = $main.offset().top + parseInt($main.css('border-top-width')) + raisedTolerance;
        let containerTop = this.$toolbox.offset().top;

        return (containerTop > mainTop || containerTop < mainTop);
    }

    enableSticky() {
        if (!this.config.is('toolbar.sticky') || this.config.is('toolbar.target')) return;

        if (this.config.is('scrollOverflow')) {
            this._startStickyOverflowEvent();
        } else {
            this._applyStickyStyles();
            this._startStickyEvent();
        }

        if (this.config.is('scrollOverflow')) {
            this._observeOverflowSticky();
        }
    }

    disableSticky() {
        if (!this.config.is('toolbar.sticky')) return;
        this._removeStickyStyles();
        this._stopStickyEvent();
    }

    observeSticky() {
        if (this._isSource()) return;

        let $scrollTarget = this.app.scroll.getTarget();
        let paddingTop = (this.app.scroll.isTarget()) ? parseInt($scrollTarget.css('padding-top')) : 0;
        let offset = parseInt(this.config.get('toolbar.stickyTopOffset'));
        let topOffset = (0 - paddingTop + offset);

        if (this.app.isProp('fullscreen')) {
            topOffset = 0;
        }

        this.$toolbox.css({ 'top': `${topOffset}px` });
        this.broadcastSticky();
    }

    broadcastSticky() {
        if (this.isSticky()) {
            this.$toolbox.addClass('rx-sticky-on');
            this.app.broadcast('toolbar.sticky');
        }
        else {
            this.$toolbox.removeClass('rx-sticky-on');
            this.app.broadcast('toolbar.static');
        }
    }

    // Private methods

    _isSource() {
        if (this.app.source.is()) {
            this.$toolbox.css('top', 0);
            return true;
        }
        return false;
    }

    _applyStickyStyles() {
        this.$toolbox.addClass('rx-sticky');
        this.$toolbox.css('top', `${this.config.get('toolbar.stickyTopOffset')}px`);
    }

    _removeStickyStyles() {
        this.$toolbox.removeClass('rx-sticky rx-fixed-on');
        this.$toolbox.css({
            'position': '',
            'z-index': '',
            'max-width': '',
            'top': ''
        });
    }

    _getStickyTarget() {
        return this.app.scroll.getTarget();
    }

    _startStickyOverflowEvent() {
        const $target = this._getStickyTarget();
        const $cont = this.app.container.get('main');
        setTimeout(() => $cont.attr('data-initial-width', $cont.width()), 0);
        $target.on(`scroll.${this.eventname}`, this._observeOverflowSticky.bind(this));
        $target.on(`resize.${this.eventname}`, this._resizeOverflowSticky.bind(this));
    }

    _startStickyEvent() {
        this._getStickyTarget().on(`scroll.${this.eventname}`, this.observeSticky.bind(this));
    }

    _stopStickyEvent() {
        this._getStickyTarget().off(`.${this.eventname}`);
    }

    _resizeOverflowSticky() {
        const $cont = this.app.container.get('main');
        $cont.css('width', '');
        $cont.attr('data-initial-width', $cont.width());

        if (this.$toolbox.hasClass('rx-fixed-on')) {
            this.$toolbox.css('max-width', `${$cont.width()}px`);
        }
    }

    _observeOverflowSticky() {
        if (this._isSource()) return;

        const rect = this.app.editor.getRect();
        const $cont = this.app.container.get('main');
        const $target = this.app.scroll.getTarget();
        const contTop = $cont.offset().top;
        const initialWidth = $cont.data('initial-width');
        const height = this.$toolbox.height();
        const tolerance = 80;
        const contBottom = rect.bottom - tolerance;
        const pageOffset = $target.get().pageYOffset;

        if (pageOffset >= contTop && pageOffset <= contBottom) {
            this._applyFixedStyles($cont, initialWidth, height);
            this.app.broadcast('toolbar.sticky');
        } else {
            this._removeFixedStyles($cont);
            this.app.broadcast('toolbar.static');
        }
    }

    _applyFixedStyles($cont, initialWidth, height) {
        this.$toolbox.css({
            'position': 'fixed',
            'z-index': 1060,
            'max-width': `${$cont.width()}px`,
            'top': '0px'
        });
        $cont.css({
            'width': `${initialWidth}px`,
            'padding-top': `${height}px`
        });
        this.$toolbox.addClass('rx-fixed-on');
    }

    _removeFixedStyles($cont) {
        this.$toolbox.css({
            'position': '',
            'z-index': '',
            'max-width': '',
            'top': ''
        });
        $cont.css({
            'width': '',
            'padding-top': ''
        });
        this.$toolbox.removeClass('rx-fixed-on');
    }
}
/*jshint esversion: 6 */
class AddBar {
    constructor(app) {
        this.app = app;

        this.customButtons = {};
        this.removeButtons = [];
    }
    add(name, obj) {
        this.customButtons[name] = obj;
        this.app.ui.registerButton(name, obj);
    }
    remove(name) {
        if (Array.isArray(name)) {
            for (let i = 0; i < name.length; i++) {
                this.removeButtons.push(name[i]);
            }
        }
        else {
            this.removeButtons.push(name);
        }
    }
    getItems() {
        let buttons = [...this.config.get('popups.addbar')];
        let addbarItems = this.config.get('addbarItems') || {};
        let customButtons = Redactor.extend(true, {}, addbarItems, this.customButtons);
        let stack = this.app.ui.loadButtons(buttons, customButtons, 'addbar', false, this.removeButtons);
        let types = ['text', 'address', 'list', 'todo', 'quote', 'dlist'];

        for (let [key, btn] of Object.entries(stack)) {
            if (types.indexOf(key) !== -1) {
                btn.setCommand('block.add');
            }
        }

        return stack;
    }
    popup(e, button) {
        let buttons = [...this.config.get('popups.addbar')];
        let addbarItems = this.config.get('addbarItems') || {};

        const removeButtonsconfig = this.config.get('addbar.hide') || [];
        this.customButtons = Redactor.extend(true, {}, addbarItems, this.customButtons);
        let removeButtons = [...this.removeButtons, ...removeButtonsconfig];

        if (!e && this.app.toolbar.isEnabled()) {
            e = button;
            button = this.app.toolbar.getButton('add');

        }

        this.app.dropdown.create('addbar', { items: buttons, extend: this.customButtons, remove: removeButtons, type: 'addbar' });
        this.app.dropdown.open(e, button);
    }
}
/*jshint esversion: 6 */
class ContextBar {
    constructor(app) {
        this.app = app;

        this.eventName = 'rx-context';
        this.instance = false;
        this.line = false;
    }
    init() {
        if (!this.isEnabled()) return;
        let builder = this.app.ui.build('context', this.app.$body);
        this.$context = builder.getElement();
        this.$contextLine = builder.getElementLine();
        this.$contextButtons = this.app.ui.getContainer('context');
        this.$context.hide();
    }
    stop() {
        if (!this.isEnabled()) return;
        this.$context.remove();
        this.app.scroll.getTarget().off('.' + this.eventName);
    }
    remove(name) {
        this.app.ui.removeButton('context', name);
    }
    addLine(html) {
        this.line = html;
    }
    add(name, obj, block) {
        this.app.ui.addButton('context', name, obj, block);
    }
    showLine(line = false) {
        line = line || this.line;
        this.$contextLine.html(line).show();
    }
    unsetActive(name) {
        this.app.ui.unsetActive('context', name);
    }
    unsetToggled(name, except) {
        this.app.ui.unsetToggled('context', name, except);
    }
    getButton(name) {
        return this.app.ui.getButton('context', name);
    }
    getElement() {
        return this.$context;
    }
    getInstance() {
        return this.instance;
    }
    isOpen() {
        if (!this.isEnabled()) return;
        return this.$context.hasClass('open');
    }
    isEnabled() {
        return this.config.is('context');
    }
    close() {
        this._close();
    }
    open() {
        this.line = false;
        if (!this.isEnabled() || this.app.block.isTool()) return;
        if (this.config.is('context.click')) {
            this._open();
            return;
        }

        const selection = new TextRange(this.app);
        const inspector = new ElementInspector(this.app);
        let current = selection.getCurrent();
        let blockSelection = this._getBlockSelection(current);
        let inlineSelection = this._getInlineSelection(current);

        if (selection.is() && inspector.isTool(current)) {
            this.app.block.setTool(true);
            return;
        }

        // context
        if (blockSelection && selection.is() && !selection.isCollapsed()) {
            this._open();
        }
        else if (inlineSelection && inlineSelection.length !== 0) {
            this.instance = inlineSelection.dataget('instance');
            if (this.instance.isContext()) {
                this._open(inlineSelection);
            }
        }
        else {
            this._close();
        }
    }
    updateEvents() {
        if (!this.isEnabled()) return;
        this.app.scroll.getTarget().off('.' + this.eventName);
        this.app.editor.getEditor().off('.' + this.eventname);
        this._buildEvents();
    }
    updatePosition() {
        if (!this.isEnabled()) return;

        let width = this.$context.width();
        let rect = this.app.editor.getRect();
        let scrollTop = this.app.page.getDoc().scrollTop();
        const selection = new TextRange(this.app);
        let pos = selection.getPosition('end');
        let topFix = 2;
        let leftFix = 2;
        let frameOffsetTop = 0;
        let frameOffsetLeft = 0;
        if (this.app.isMode('iframe')) {
            let frameOffset = this.app.editor.getRect();
            frameOffsetTop = frameOffset.top;
            frameOffsetLeft = frameOffset.left;
        }

        const selPos = selection.getPosition();
        let left = selPos.left + frameOffsetLeft + leftFix;
        let top = selPos.bottom + frameOffsetTop + scrollTop;

        // multiple selected
        if (this.app.blocks.is() && pos.left === 0 && pos.top === 0) {
            scrollTop = 0;
            let last = this.app.blocks.get({ last: true, selected: true, instances: true });
            let lastOffset = last.getOffset();

            left = lastOffset.left + frameOffsetLeft + leftFix;
            top = lastOffset.top + last.getBlock().height();
        }

        // select all
        if (this.app.editor.isSelectAll()) {
            let $last = this.app.blocks.get({ last: true });
            let lastOffset = $last.offset();

            left = lastOffset.left + frameOffsetLeft + leftFix;
            top = lastOffset.top + frameOffsetTop + $last.height()  + scrollTop;
        }

        // right edge
        if ((left + width) > rect.right) {
            left = pos.left + frameOffsetLeft - width - leftFix;
        }

        if ((pos.left - frameOffsetLeft) === 0 && (pos.right - frameOffsetTop) === 0 && this.instance) {
            let offset = this.instance.getOffset();
            let $block = this.instance.getBlock();
            let height = $block.height();
            left = offset.left;
            top = offset.top + height;
        }

        this.app.ui.buildDepth('context', this.$context);
        this.$context.css({
            left: left + 'px',
            top: (top + topFix) + 'px'
        });
        this.$context.attr({
            'dir': this.config.get('dir'),
            'rx-data-theme': this.app.editor.getTheme()
        });
    }

    // private
    _open(inlineSelection) {
        if (!this._shouldShowToolbar()) {
            return;
        }

        this.$contextLine.html('').hide();
        if (this.instance) {
            this.$contextButtons.html('');
        }

        // build buttons
        this.app.ui.buildButtons('context', this.instance, inlineSelection);

        if (this.$contextButtons.html() === '') {
            this.instance = false;
        }

        if (this.line) {
            this.$contextLine.html(this.line).show();
        }

        this._buildPosition();
        this._buildEvents();

        // broadcast
        this.app.broadcast('context.open');
    }
    _shouldShowToolbar() {
        if (!this.config.is('context.exclude') && !this.config.is('context.include')) {
            return true;
        }

        const selection = new TextRange(this.app);
        const blocks = selection.getNodes({ type: 'block' });
        const excludeData = this.config.get('context.exclude') || {};
        const includeData = this.config.get('context.include') || {};

        const excludeTags = excludeData.tags || [];
        const excludeBlocks = excludeData.blocks || [];
        const includeTags = includeData.tags || [];
        const includeBlocks = includeData.blocks || [];

        for (let block of blocks) {
            const tagName = block.tagName.toLowerCase();
            const blockType = block.getAttribute('data-rx-type');

            if (excludeTags.includes(tagName) || excludeBlocks.includes(blockType)) {
                return false;
            }

            if (includeTags.length || includeBlocks.length) {
                if (!includeTags.includes(tagName) && !includeBlocks.includes(blockType)) {
                    return false;
                }
            }
        }

        return true;
    }
    _close() {
        if (!this.isEnabled() || !this.$context.hasClass('open')) return;

        this.$context.hide().removeClass('open');
        this.instance = false;

        // stop events
        this.app.scroll.getTarget().off('.' + this.eventname);
        this.app.editor.getEditor().off('.' + this.eventname);

        // broadcast
        this.app.broadcast('context.close');
    }
    _getBlockSelection(current) {
        return this.dom(current).closest('[data-rx-inline], [data-rx-type=noneditable], [data-rx-type=figcaption]').length !== 0 ? false : true;
    }
    _getInlineSelection(current) {
        if (current) {
            return this.dom(current).closest('[data-rx-inline]');
        } else {
            return this.app.editor.getLayout().find('[data-rx-inline]').filter($n => {
                return $n.hasClass('rx-block-focus');
            }).eq(0);
        }
    }
    _buildPosition() {
        this.$context.addClass('open');
        this.updatePosition();
        this.$context.show();
    }
    _buildEvents() {
        let $target = this.app.scroll.getTarget();

        if (this.app.scroll.isTarget()) {
            $target.on('scroll.' + this.eventname, this._scroll.bind(this));
        }

        $target.on('resize.' + this.eventName, this.updatePosition.bind(this));
        this.app.editor.getEditor().on('scroll.' + this.eventname, this._scroll.bind(this));
    }
    _scroll() {
        const updateContextPositionAndVisibility = ($element, tolerance = 0) => {
            const elementTop = $element.offset().top + tolerance;
            const elementBottom = elementTop + $element.height();
            const contextBottom = contextTop + this.$context.height();

            if (contextBottom > elementBottom || elementTop > contextTop) {
                this.$context.hide();
                return true; // context is already hidden
            }
            else if (this.isOpen()) {
                this.$context.show();
                return false;
            }
        };

        const selection = new TextRange(this.app);
        const position = selection.getPosition('end');
        const scrollTop = this.app.page.getDoc().scrollTop();
        const topFix = 2;
        const contextTop = position.bottom + scrollTop + topFix;

        this.$context.css('top', `${contextTop}px`);

        let alreadyHidden = false;

        if (this.app.scroll.isTarget()) {
            const $target = this.app.scroll.getTarget();
            alreadyHidden = updateContextPositionAndVisibility($target, 20);
        }

        if (this.config.is('maxHeight') && !alreadyHidden) {
            const $editor = this.app.editor.getEditor();
            updateContextPositionAndVisibility($editor);
        }
    }
    _isInstance($el) {
        let instance = this.app.block.get();
        let isInstance = (instance && instance.isEditable());
        let isType = (instance && instance.getType() !== 'pre');

        return (isInstance && isType);
    }
}
/*jshint esversion: 6 */
class ControlBar {
    constructor(app) {
        this.app = app;

        this.eventName = 'rx-control';
        this.parentTypes = {
            list: [
                { name: 'parent', title: '## list.select-list ##' }
            ],
            cell: [
                { name: 'parent', title: '## table.select-table ##' },
                'cell-setting'
            ],
            cellParent: [
                { name: 'parent', title: '## table.select-table ##' },
                { name: 'parent', title: '## table.select-cell ##', params: { cell: true } }
            ],
            column: [
                { name: 'parent', title: '## layout.select-layout ##' },
                { name: 'parent', title: '## layout.select-column ##', params: { column: true } }
            ]
        };
    }
    init() {
        if (!this.isEnabled()) return;
        this._buildToolbar();
    }
    stop() {
        if (!this.isEnabled()) return;
        this._removeControl();
        this._stopEvents();
    }
    add(name, obj) {
        this.app.ui.addButton('control', name, obj);
    }
    remove(name) {
        this.app.ui.removeButton('control', name);
    }
    isEnabled() {
        return this.config.is('control');
    }
    build() {
        let instance = this.app.block.get();
        instance ? this.open(instance) : this.close();
    }
    getButton(name) {
        return this.app.ui.getButton('control', name);
    }
    getElement() {
        return this.$control;
    }
    trigger() {
        if (!this.isEnabled()) return;
        this.getButton('toggle').getElement().click();
    }
    popup(e, button) {
        if (this._shouldCloseDropdown()) {
            this.app.dropdown.close();
            return;
        }

        let buttons = [...this.config.get('popups.control')];
        const parent = this._getParentElement();

        if (parent) {
            buttons = this._getParentButtons(buttons);
        }

        const customButtons = this.app.ui.getButtonsCustom('control');
        const removeButtons = this.app.ui.getButtonsRemove('control');

        this.app.dropdown.create('control', { items: buttons, extend: customButtons, remove: removeButtons });
        this.app.dropdown.open(e, button);
    }
    open(instance) {
        if (!this.isEnabled()) return;

        this.instance = instance;
        if (!this._hasControl()) {
            this.close();
            return;
        }

        this._setParentInstance();
        if (this.instance) {
            this._buildEvents();
            this._prepareToOpen();
            this._updatePositions();
            this._buildReorder();
        }
        else {
            this.close();
        }
    }
    close() {
        if (!this.isEnabled() || !this.$control) return;

        this.$control.hide();
        this._stopEvents();
        this.instance = false;
    }
    updateEvents() {
        if (!this.isEnabled()) return;
        this._stopEvents();
        this._buildEvents();
    }
    updatePosition() {
        if (!this.isEnabled() || !this.instance) {
            this.close();
            return;
        }

        const { top, left } = this._calculatePosition();
        this.$control.show();

        if (this._shouldHideForScrollTarget(top) || this._shouldHideForEditor(top)) {
            this.$control.hide();
        }

        this._setPosition(top, left);
    }

    // =private
    _calculatePosition() {
        const offset = this.instance.getOffset();
        const width = this.$control.width();
        const { topOutlineFix, leftOutlineFix } = this._getOutlineFixes();
        const { frameOffsetTop, frameOffsetLeft } = this._getFrameOffsets();
        const marginLeft = parseInt(this.instance.getBlock().css('margin-left'));
        const adjustedLeftOutlineFix = this._getAdjustedLeftOutlineFix(leftOutlineFix, marginLeft);

        const top = offset.top + frameOffsetTop - topOutlineFix;
        const left = offset.left + frameOffsetLeft - width - adjustedLeftOutlineFix;
        return { top, left };
    }
    _getOutlineFixes() {
        const paddingTop = parseInt(this.instance.getBlock().css('padding-top'));
        const isLine = this.instance.isType('line');
        const topOutlineFix = (isLine && paddingTop === 0) ? 14 : 5;

        return { topOutlineFix, leftOutlineFix: 5 };
    }
    _getFrameOffsets() {
        let frameOffsetTop = 0;
        let frameOffsetLeft = 0;

        if (this.app.isMode('iframe')) {
            const frameOffset = this.app.editor.getRect();
            frameOffsetTop = frameOffset.top;
            frameOffsetLeft = frameOffset.left;
        }

        return { frameOffsetTop, frameOffsetLeft };
    }
    _getAdjustedLeftOutlineFix(leftOutlineFix, marginLeft) {
        return marginLeft < 0 ? leftOutlineFix + marginLeft : leftOutlineFix;
    }
    _shouldHideForScrollTarget(top) {
        if (this.app.scroll.isTarget()) {
            const $target = this.app.scroll.getTarget();
            const targetBottom = $target.offset().top + $target.height();
            const targetTop = $target.offset().top;
            const bottom = top + this.$control.height();
            const targetTolerance = parseInt($target.css('padding-top'));

            return bottom > targetBottom || targetTop + targetTolerance > top;
        }

        return false;
    }
    _shouldHideForEditor(top) {
        if (this.config.is('maxHeight')) {
            const $editor = this.app.editor.getEditor();
            const editorBottom = $editor.offset().top + $editor.height();
            const editorTop = $editor.offset().top;
            const checkBottom = top + this.$control.height();

            return checkBottom > editorBottom || editorTop > top;
        }

        return false;
    }
    _setPosition(top, left) {
        this.app.ui.buildDepth('control', this.$control);
        this.$control.css({ top: `${top}px`, left: `${left}px` });
    }
    _removeControl() {
        this.$control.remove();
    }
    _shouldCloseDropdown() {
        return this.app.dropdown.isOpen() && this.app.dropdown.getName() === 'control';
    }
    _getParentElement() {
        return this.instance.getClosest(['list', 'wrapper', 'layout', 'todo', 'table']);
    }
    _getParentButtons(buttons) {
        if (this.instance.isType('cell')) {
            buttons.unshift(...this.parentTypes.cell);
        } else if (this.instance.getClosest('cell')) {
            buttons.unshift(...this.parentTypes.cellParent);
        } else if (this.instance.getClosest('column')) {
            buttons.unshift(...this.parentTypes.column);
        } else if (this.instance.getClosest('list')) {
            buttons.unshift(...this.parentTypes.list);
        } else {
            buttons.unshift('parent');
        }

        return buttons;
    }
    _setParentInstance() {
        if (this.instance.isParent()) {
            this.instance = this.instance.getParent();
        }
    }
    _prepareToOpen() {
        this.app.ui.buildButtons('control');
        this.$control.attr('rx-data-theme', this.app.editor.getTheme());
        this.$control.show();
    }
    _hasControl() {
        return this.instance.getControl() !== false;
    }
    _updatePositions() {
        this.updatePosition();
        this.app.dropdown.updatePosition();
    }
    _stopEvents() {
        this.app.scroll.getTarget().off('.' + this.eventName);
        this.app.editor.getEditor().off('.' + this.eventName);
    }
    _buildReorder() {
        const button = this.getButton('toggle');
        if (this.config.is('reorder') && this.instance.isReorder()) {
            new Reorder(this.app, this, button, this.$control, this.instance);
        }
    }
    _buildToolbar() {
        this.$control = this.app.ui.build('control', this.app.$body).getElement();
        this.$control.hide();
    }
    _buildEvents() {
        let $target = this.app.scroll.getTarget();
        $target.on('resize.' + this.eventName, this.updatePosition.bind(this));
        $target.on('scroll.' + this.eventName, this.updatePosition.bind(this));
        this.app.editor.getEditor().on('scroll.' + this.eventName, this.updatePosition.bind(this));
    }
}
/*jshint esversion: 6 */
class PathBar {
    constructor(app) {
        this.app = app;

        this.classname = 'rx-pathbar';
        this.activeClass = 'active';
        this.pathItemClass = 'rx-pathbar-item';
    }
    init() {
        if (!this.config.is('pathbar')) return;

        this.$pathbar = this.dom('<div>').attr('dir', this.config.get('dir'));
        this.$pathbar.addClass(this.classname + ' ' + this.classname + '-' + this.uuid);

        this.app.container.get('pathbar').append(this.$pathbar);

        // build
        this._buildRoot();
        this._buildActive();
    }
    build() {
        if (!this.config.is('pathbar')) return;

        this._clear();
        this._buildRoot();

        if (!this.app.blocks.is()) {
            this._buildItems();
            this._buildActive();
        }
    }
    enable() {
        if (!this.config.is('pathbar')) return;
        this.$pathbar.removeClass('disable');
    }
    disable() {
        if (!this.config.is('pathbar')) return;
        this.$pathbar.addClass('disable');
    }

    // =private
    _clear() {
        this.$pathbar.find('.' + this.pathItemClass).off('.rx-path-' + this.uuid);
        this.$pathbar.html('');
    }
    _createItem() {
        return this.dom('<span>').addClass(this.pathItemClass);
    }
    _buildRoot() {
        let title = this.config.get('pathbar.title');
        title = title || this.loc.get('pathbar.title');

        this._buildItem(false, title);
    }
    _buildItems() {
        let current = this.app.block.get();
        if (!current) return;

        // parents
        let $parents = current.getBlock().parents('[data-rx-type]');
        $parents.nodes.reverse();
        $parents.each(this._buildParentItem.bind(this));

        // current
        this._buildItem(current);
    }
    _buildParentItem($el) {
        let instance = $el.dataget('instance');
        let ignoreTypes = ['row'];

        if (!instance.isType(ignoreTypes)) {
            this._buildItem(instance);
        }
    }
    _buildItem(instance, root) {
        let $item = this._createItem();
        $item.dataset('instance', instance);
        $item.on('click.rx-path-' + this.uuid, this._selectItem.bind(this));

        this._buildTitle($item, root || instance.getTitle());
        this.$pathbar.append($item);
    }
    _buildTitle($item, title) {
        let $title = this.dom('<span>').html(title);
        $item.append($title);
    }
    _buildActive() {
        this.$pathbar.find('.' + this.pathItemClass).removeClass(this.activeClass).last().addClass(this.activeClass);
    }
    _selectItem(e) {
        e.stopPropagation();
        e.preventDefault();

        if (this.$pathbar.hasClass('disable')) return;

        let $item = this.dom(e.target).closest('.' + this.pathItemClass);
        let instance = $item.dataget('instance');

        this.app.dropdown.close();
        this.app.context.close();

        if (instance) {
            let point = instance.isType('column') ? 'column' : false;
            this.app.block.set(instance, point);
        }
        else {
            this._clear();
            this._buildRoot();
            this._buildActive();

            this.app.block.unset();
            this.app.blocks.unset();
        }
    }
}
/*jshint esversion: 6 */
class StatusBar {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
        this.config = app.config;

        this.classname = 'rx-statusbar';
        this.isSticky = this.config.is('statusbar.sticky');
        this.onScroll = this._onScroll.bind(this);
    }

    init() {
        this.$statusbar = this.dom('<div>')
            .attr('dir', this.app.config.get('dir'))
            .addClass(this.classname + ' ' + this.classname + '-' + this.uuid);

        // containers
        this.$leftContainer = this.dom('<div>').addClass(`${this.classname}-start`);
        this.$rightContainer = this.dom('<div>').addClass(`${this.classname}-end`);

        this.$statusbar.append(this.$leftContainer, this.$rightContainer);

        if (this.isSticky) {
            this.$statusbar.addClass('rx-statusbar-sticky');
            this.updatePosition();
            this._attachEvents();
        }

        this.app.container.get('statusbar').append(this.$statusbar);
    }

    is() {
        return (this.$statusbar.html() !== '');
    }

    enable() {
        this.$statusbar.removeClass('disable');
    }

    disable() {
        this.$statusbar.addClass('disable');
    }

    add(name, html, align = 'start') {
        return this.update(name, html, align);
    }

    update(name, html, align = 'start') {
        let $container = align === 'end' ? this.$rightContainer : this.$leftContainer;
        let $item = $container.find(`[data-name="${name}"]`);

        if ($item.length === 0) {
            $item = this._buildItem(name);
            $container.append($item);
        }

        $item.html(html);

        if (this.isSticky) {
            this.updatePosition();
        }

        return $item;
    }

    getHeight() {
        return this.is() ? this.$statusbar.outerHeight() : 0;
    }

    getElement() {
        return this.$statusbar;
    }

    get(name, align = 'start') {
        let $container = align === 'end' ? this.$rightContainer : this.$leftContainer;
        return $container.find(`[data-name="${name}"]`);
    }

    remove(name, align = 'start') {
        this.get(name, align).remove();
    }

    clear(align = 'both') {
        if (align === 'start' || align === 'both') {
            this.$leftContainer.empty();
        }
        if (align === 'end' || align === 'both') {
            this.$rightContainer.empty();
        }
    }

    destroy() {
        if (this.isSticky) {
            this._detachEvents();
        }
        this.$statusbar.remove();
    }

    updatePosition() {
        if (!this.isSticky) return;

        const editor = this.app.editor.getEditor().get();
        const editorRect = editor.getBoundingClientRect();
        const tolerance = this.config.is('toolbar') ? 120 : 60;
        const visibility = this.app.scroll.getVisibility(tolerance);

        if (!visibility.isBottomEdge) {
            return this._clearStatusBarPosition();
        }
        else if (visibility.isTopEdge && visibility.isTopVisible) {
            return this._setStatusBarPosition(editor, editorRect, visibility);
        }
        else if (!visibility.isTopEdge && !visibility.isBottomVisible) {
            return this._setStatusBarPosition(editor, editorRect, visibility);
        }
        else if (visibility.isTopEdge || visibility.isBottomVisible) {
            return this._clearStatusBarPosition();
        }

        this._setStatusBarPosition(editor, editorRect, visibility);
    }

    // Private methods

    _buildItem(name) {
        let $item = this.dom('<span>')
            .addClass(this.classname + '-item')
            .attr('data-name', name);

        this.$statusbar.append($item);
        return $item;
    }

    _setStatusBarPosition(editor, editorRect, visibility) {
        if (this.app.scroll.isTarget()) {
            this.$statusbar.css({
                position: 'absolute',
                width: `${editorRect.width}px`,
                left: `${editor.offsetLeft}px`,
                top: `${visibility.bottom - this.getHeight()}px`
            });
        } else {
            this.$statusbar.css({
                position: 'fixed',
                width: `${editorRect.width}px`,
                left: `${editorRect.left}px`,
                bottom: 0
            });
        }
    }

    _clearStatusBarPosition() {
        this.$statusbar.css({
            position: '',
            width: '',
            top: '',
            left: '',
            bottom: ''
        });
    }

    _attachEvents() {
        this.app.scroll.getTarget().on('scroll', this.onScroll);
        window.addEventListener('resize', this.onScroll);
    }

    _detachEvents() {
        this.app.scroll.getTarget().off('scroll', this.onScroll);
        window.removeEventListener('resize', this.onScroll);
    }

    _onScroll() {
        this.updatePosition();
    }
}
class Dropdown {
    constructor(app) {
        this.app = app;

        this.name = false;
        this.trigger = false;
        this.savedSelection = false;
        this.tabs = {};

        this._isOpen = false;
        this._keydownHandler = null;
        this._inheritPosition = false;

        this.defs = {
            title: false,
            panel: false,
            grid: false,
            tabs: false,
            form: false,
            focus: false,
            width: false,
            html: false,
            maxWidth: false,
            replace: false,
            items: false,
            remove: false,
            extend: false,
            passive: false,
            keys: []
        };
    }

    init() {
        const dropdown = document.createElement('div');
        dropdown.className = `rx-dropdown rx-dropdown-${this.uuid} rx-hidden`;
        dropdown.dir = this.config.get('dir');
        dropdown.setAttribute('rx-data-theme', this.app.editor.getTheme());

        const dropdownTitle = document.createElement('div');
        dropdownTitle.className = 'rx-dropdown-title';

        const dropdownTabs = document.createElement('div');
        dropdownTabs.className = 'rx-dropdown-tabs';

        const dropdownItems = document.createElement('div');
        dropdownItems.className = 'rx-dropdown-items';

        dropdown.appendChild(dropdownTitle);
        dropdown.appendChild(dropdownTabs);
        dropdown.appendChild(dropdownItems);

        this.dropdown = dropdown;
        this.dropdownTitle = dropdownTitle;
        this.dropdownTabs = dropdownTabs;
        this.dropdownItems = dropdownItems;

        this.app.$body.append(dropdown);
    }

    stop() {
        this.app.$body.find('.rx-dropdown-' + this.uuid).remove();
    }

    isPositionTop() {
        return false;
    }

    isOpen() {
        return this._isOpen;
    }

    isPanel() {
        return this.params.panel;
    }

    getElement() {
        return this.dropdown;
    }

    getName() {
        return this.name;
    }

    getForm() {
        return this.params.form;
    }

    getTabForm(name) {
        return this.tabs[name].form;
    }

    addTab(name, params) {
        this.tabs[name] = params;
    }

    getTabBox(name) {
        return this.dropdownItems.querySelector(`[data-tab-box=${name}]`);
    }

    setTabItems(name, items) {
        const target = this.getTabBox(name);
        this._renderItems(items, target);
    }

    create(name, params) {
        this.params = Redactor.extend({}, this.defs, params);
        this.name = name;
        this.tabs = {};

        this.dropdownTitle.innerHTML = this.params.title ? this.params.title : '';
        this.dropdownTabs.innerHTML = '';
        this.dropdownItems.innerHTML = '';
        this.dropdown.style.width = '';
        this.dropdown.style.maxWidth = '';
        this.dropdown.style.maxHeight = '';
        this.dropdown.classList.remove('rx-dropdown-type-grid');
    }

    open(e, trigger) {
        if (this.dropdown.dataset.name === this.name) {
            return this.close();
        }

        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
        }

        this._stopEvents();

        // emit
        this.app.emit('dropdown.before.open', { dropdown: this });

        this.dropdown.dataset.name = this.name;
        this._isOpen = true;

        const currentTrigger = trigger.isButton ? trigger.getElement().get() : trigger;

        if (this.params.grid) {
            this.dropdown.classList.add('rx-dropdown-type-grid');
        }

        // Previous trigger
        if (this.trigger) {
            this.trigger.classList.remove('pressed');
        }

        this.trigger = currentTrigger;
        if (trigger.isButton) {
            this.trigger.classList.add('pressed');
        }

        if (this._inheritPosition && this._openAtCoords) {
            const { x, y } = this._openAtCoords;
            this._openAtCoords = null;
            this.openAt({ x, y });
            return;
        }

        // not replace dropdown position
        if (!this.params.replace && !this.trigger.classList.contains('rx-option-item')) {
            this.saveSelection();
        }

        const tabFocus = this._buildItems();
        const triggerRect = this.trigger.getBoundingClientRect();
        const { top, left } = this._getPosition(triggerRect);

        this._setSize(triggerRect);
        this._setPosition(left, top);
        this.dropdown.classList.remove('rx-hidden');
        this._inheritPosition = false;

        this._setFocus(tabFocus);
        this._buildDepth();
        this._startEvents();
        this.app.event.setStrategyMouseUp(false);

        // emit
        this.app.emit('dropdown.open', { dropdown: this });
    }

    openAt({ x, y }) {
        if (this._isOpen) this.close();
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
        }

        this._isOpen = true;
        this._openAtCoords = { x, y };
        this._inheritPosition = false;
        this.dropdown.dataset.name = this.name;

        this.saveSelection();
        this._buildItems();

        this._setSize();
        this._setPosition(x, y);
        this.dropdown.classList.remove('rx-hidden');
        this.app.event.setStrategyMouseUp(false);

        this._setFocus();
        this._buildDepth();

        // emit
        this.app.emit('dropdown.open', { dropdown: this });
    }

    close() {
        if (!this._isOpen) return;

        if (this.trigger) {
            this.trigger.classList.remove('pressed');
        }

        this._isOpen = false;
        this.name = false;
        this.savedSelection = false;

        this.dropdown.dataset.name = '';
        this.dropdown.classList.add('rx-hidden');
        this.app.event.eventStrategy.isPopupMouseUp = false;

        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
        }

        // emit
        this.app.emit('dropdown.close');
    }

    updatePosition() {
        if (!this.isOpen()) return;

        const triggerRect = this.trigger.getBoundingClientRect();
        const { top, left } = this._getPosition(triggerRect);

        this._setSize(triggerRect);
        this._setPosition(left, top);

        if (left === 0 && top === 0) {
            this.dropdown.classList.add('rx-hidden');
        } else {
            this.dropdown.classList.remove('rx-hidden');
        }
    }

    saveSelection(el) {
        const offset = new Offset(this.app);
        const instance = this.app.block.get();

        if (el !== false) {
            el = (instance && !this.app.blocks.is()) ? instance.getBlock() : this.app.editor.getLayout();
        }

        const offsetData = offset.get();
        this.savedSelection = { el: el, offset: offsetData };
    }

    restoreSelection() {
        if (!this.savedSelection) return;

        const { el, offset } = this.savedSelection;
        const instance = this.dom(el).dataget('instance');

        if (instance) {
            this.app.block.set(el);
        }

        //if (el) el.focus();
        if (offset) {
            const offsetManager = this.app.create('offset');
            offsetManager.set(offset);
        }
    }

    // Private methods

    _startEvents() {
        this.app.scroll.getTarget().on('resize.rx-dropdown scroll.rx-dropdown', this.updatePosition.bind(this));
        this.app.editor.getEditor().on('scroll.rx-dropdown', this.updatePosition.bind(this));
    }

    _stopEvents() {
        this.app.scroll.getTarget().off('.rx-dropdown');
        this.app.editor.getEditor().off('.rx-dropdown');
    }

    _buildDepth() {
        let depth = '';

        if (this.config.is('bsmodal')) {
            depth = 1061;
        } else if (this.app.isProp('fullscreen')) {
            depth = 10001;
        }

        this.dropdown.style.zIndex = depth;
    }

    _buildItems() {
        let tabFocus;
        if (Object.keys(this.tabs).length) {
            let index = 0;
            Object.entries(this.tabs).forEach(([key, item]) => {
                const tab = document.createElement('span');
                tab.className = 'rx-dropdown-tab';
                tab.dataset.tab = key;
                tab.innerHTML = this.loc.parse(item.title);

                tab.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const tabItem = e.target.closest('.rx-dropdown-tab');
                    const tabName = tabItem.dataset.tab;
                    this.dropdownTabs.querySelectorAll('.rx-dropdown-tab').forEach(el => el.classList.remove('active'));
                    this.dropdownItems.querySelectorAll('.rx-dropdown-tab-box').forEach(el => {
                        const tabkey = el.dataset.tabBox;
                        el.classList.toggle('rx-hidden', tabkey !== tabName);
                    });

                    tabItem.classList.add('active');
                    this.app.event.setStrategyMouseUp(false);
                });

                const tabBox = document.createElement('div');
                tabBox.className = 'rx-dropdown-tab-box';
                tabBox.dataset.tabBox = key;

                if (index === 0) {
                    tab.classList.add('active');
                } else {
                    tabBox.classList.add('rx-hidden');
                }

                if (item.form) {
                    this._renderForm(item.form, tabBox);
                    if (item.focus && !tabFocus) {
                        tabFocus = item;
                    }
                } else if (item.html) {
                    this.dom(tabBox).append(item.html);
                } else if (item.items) {

                }

                this.dropdownTabs.appendChild(tab);
                this.dropdownItems.appendChild(tabBox);

                index++;
            });
        }
        else if (this.params.form) {
            this._renderForm(this.params.form, this.dropdownItems);
        } else if (this.params.html) {
            this.dom(this.dropdownItems).append(this.params.html);
        } else {
            this._renderItems(this.params.items, this.dropdownItems);
            this._handleNavigate();
        }

        return tabFocus;
    }

    _getPosition(triggerRect) {
        const isWindow = !this.app.scroll.isTarget();
        const scrollTarget = this.app.scroll.getTarget().get();

        let scrollTop = isWindow ? scrollTarget.scrollY : 0;

        if (this.app.isProp('fullscreen')) {
            scrollTop = window.scrollY;
        }

        let top = triggerRect.top + triggerRect.height + scrollTop;
        let left = triggerRect.left;

        if (this.params.replace || this.trigger.classList.contains('rx-option-item')) {
            const dropdownRect = this.dropdown.getBoundingClientRect();
            top = dropdownRect.top + scrollTop;
            left = dropdownRect.left;
        }

        this.dropdown.style.visibility = 'hidden';
        this.dropdown.classList.remove('rx-hidden');

        const dropdownWidth = this._getSize();
        const editorBody = this.app.editor.getEditor().get();
        const editorRect = editorBody.getBoundingClientRect();

        const dropdownRight = left + dropdownWidth;
        const editorRight = editorRect.right;

        if (dropdownRight > editorRight) {
            // try to make the right edge of the dropdown aligned to the editor
            left = Math.max(editorRight - dropdownWidth, editorRect.left);
        }

        this.dropdown.style.visibility = '';
        this.dropdown.classList.add('rx-hidden');

        return { top, left };
    }

    _setPosition(x, y) {
        this.dropdown.style.top = `${y}px`;
        this.dropdown.style.left = `${x}px`;
    }

    _getSize() {
        if (this.params.width || this.params.maxWidth) {
            return parseInt(this.params.width || this.dropdown.style.maxWidth);
        }

        return this.dropdown.getBoundingClientRect().width;
    }

    _setSize(triggerRect = false) {
        // Width / Max-width
        if (this.params.width) this.dropdown.style.width = this.params.width;
        if (this.params.maxWidth) this.dropdown.style.maxWidth = this.params.maxWidth;

        // Max-height from available screen
        const availableHeight = window.innerHeight - (triggerRect ? triggerRect.bottom : 0);
        this._adjustMaxHeight(availableHeight);
    }

    _setFocus(tabFocus) {
        if (this.params.form && this.params.focus) {
            this.params.form.setFocus(this.params.focus);
        }

        if (tabFocus) {
            tabFocus.form.setFocus(tabFocus.focus);
        }
    }

    _renderItems(items, target) {
        items = this._prepareItems(items);

        const addbarTypes = ['text', 'address', 'list', 'todo', 'quote', 'dlist'];
        const list = document.createElement('ul');
        list.className = 'rx-option-list';

        Object.entries(items).forEach(([key, item]) => {
            const observed = this._checkObserve(key, item);
            if (!observed || !this._checkPermissions(key, item)) {
                return;
            }

            item = observed !== true ? observed : item;

            const li = document.createElement('li');

            let container;
            if (item.items) {
                li.className = 'rx-option-header';
                li.innerHTML = item.title;

                container = document.createElement('li');
                if (item.grid) {
                    container.className = 'rx-dropdown-grid-container';
                }

                this._renderItems(item.items, container);

            } else {
                li.className = 'rx-option-item';

                if (this.params.passive) li.classList.add('passive');
                if (item.active) li.classList.add('active');
                if (item.disabled) li.classList.add('disabled');
                if (item.classname) li.classList.add(item.classname);

                const label = document.createElement('label');
                label.className = 'rx-option-label';

                if (item.name) label.dataset.name = item.name;
                if (item.danger) label.classList.add('danger');

                const itemIcon = document.createElement('span');
                itemIcon.className = 'rx-option-icon';
                label.append(itemIcon);

                if (item.icon) {
                    itemIcon.innerHTML = item.icon;
                }

                const itemText = document.createElement('span');
                itemText.className = 'rx-option-text';
                if (item.size) {
                    itemText.classList.add(`rx-option-text-${item.size}`);
                }

                itemText.innerHTML = item.title !== undefined ? this.loc.parse(item.title) : '';
                label.append(itemText);

                if (item.shortcut) {
                    const itemShortcut = document.createElement('span');
                    itemShortcut.className = 'rx-option-shortcut';
                    itemShortcut.innerHTML = item.shortcut;
                    label.append(itemShortcut);
                }

                if (item.template) {
                    item.params = { ...(item.params ?? {}), template: item.template };
                }

                if (item.command) {
                    const isAddCommand = this.name === 'addbar' && addbarTypes.includes(item.name);
                    const command = isAddCommand ? 'block.add' : item.command;
                    const name = item.name || key;

                    li.dataset.rxCommand = command;

                    if (item.beforeCall) {
                        li.dataset.beforeCall = item.beforeCall;
                    }

                    li.dataset.name = name;

                    if (item.params) {
                        li.dataset.params = JSON.stringify(item.params, (key, value) => {
                            return key === 'icon' ? undefined : value;
                        });
                    }

                    li.addEventListener('click', (e) => {
                        e.preventDefault();
                        this._executeCommand(command, item.beforeCall, item.params, li, name, e);
                    });
                }

                li.appendChild(label);
            }

            list.appendChild(li);
            if (container) {
                list.appendChild(container);
            }
        });

        target.appendChild(list);

        if (this.params.keys.length !== 0) {
            this._setActiveKeys(this.params.keys);
        }
    }

    _renderForm(form, target) {
        const $form = form.getElement();
        this.dom(target).append($form);

        $form.on('keydown', (e) => {
            if (e.key !== 'Enter') return;

            const isInput = ['INPUT'].includes(e.target.tagName);
            if (!isInput) return;

            let command;
            const $primary = $form.find('[data-role="primary"]').first();
            if ($primary.length && $primary.attr('data-command')) {
                command = $primary.attr('data-command');
            } else if (form.getCommand()) {
                command = form.getCommand();
            }

            if (command) {
                e.preventDefault();
                this.restoreSelection();
                this.app.api(command, form);
            }
        });
    }

    _adjustMaxHeight(availableHeight) {
        const maxHeight = Math.max(availableHeight - 10, 120);
        this.dropdown.style.maxHeight = `${maxHeight}px`;
    }

    _executeCommand(command, beforeCall, params, target, name, e) {
        this.restoreSelection();

        if (this.name === 'panel' && /popup/.test(command)) {
            this._inheritPosition = true;
        }

        if (beforeCall) this.app.api(beforeCall, params, target, name, e);
        this.app.api(command, params, target, name, e);
    }

    _checkPermissions(key, item) {
        const instance = this.app.block.get();
        return !(instance && !instance.isAllowedButton(item.name, item));
    }

    _checkObserve(key, item) {
        if (item.observer) {
            let updatedObj = this._fetchUpdatedObject(item);
            if (!updatedObj) return false;
            return updatedObj;
        }

        return true;
    }

    _fetchUpdatedObject(item) {
        const obj = this.app.api(item.observer, item, item.name, item.toolbar);
        return obj ? obj : false;
    }

    _setActiveKeys(keys) {
        for (let i = 0; i < keys.length; i++) {
            const elms = this.dropdown.querySelectorAll('[data-name=' + keys[i] + ']');
            elms.forEach(el => {
                el.parentNode.classList.add('active');
            });
        }
    }

    _handleNavigate() {
        const items = Array.from(this.dropdown.querySelectorAll('.rx-option-item'));
        let index = -1;

        const getRect = el => el.getBoundingClientRect();
        const getCenter = el => {
            const rect = getRect(el);
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        };

        const focusItem = i => {
            items.forEach((item, idx) => item.classList.toggle('focus', idx === i));
            items[i]?.scrollIntoView({ block: 'nearest' });
        };

        this._keydownHandler = (e) => {
            if (!this.isOpen() || items.length === 0) return;

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();

                if (index === -1) {
                    index = 0;
                    focusItem(index);
                    return;
                }

                const current = items[index];
                const currentCenter = getCenter(current);
                let candidates = items
                    .map((item, i) => ({ el: item, index: i, center: getCenter(item) }))
                    .filter(obj => obj.index !== index);

                const axis = {
                    'ArrowDown': obj => obj.center.y > currentCenter.y && Math.abs(obj.center.x - currentCenter.x) < obj.el.offsetWidth,
                    'ArrowUp': obj => obj.center.y < currentCenter.y && Math.abs(obj.center.x - currentCenter.x) < obj.el.offsetWidth,
                    'ArrowRight': obj => obj.center.x > currentCenter.x && Math.abs(obj.center.y - currentCenter.y) < obj.el.offsetHeight,
                    'ArrowLeft': obj => obj.center.x < currentCenter.x && Math.abs(obj.center.y - currentCenter.y) < obj.el.offsetHeight,
                };

                const direction = axis[e.key];
                candidates = candidates.filter(direction);

                if (candidates.length > 0) {
                    // Find the closest one by distance
                    candidates.sort((a, b) => {
                        const da = Math.hypot(a.center.x - currentCenter.x, a.center.y - currentCenter.y);
                        const db = Math.hypot(b.center.x - currentCenter.x, b.center.y - currentCenter.y);
                        return da - db;
                    });

                    index = candidates[0].index;
                    focusItem(index);
                }

            } else if (e.key === 'Enter' && index !== -1) {
                e.preventDefault();
                const item = items[index];
                const command = item.dataset.rxCommand;
                const beforeCall = item.dataset.beforeCall;
                const name = item.dataset.name || null;
                const params = item.dataset.params ? JSON.parse(item.dataset.params) : {};
                if (command) {
                    this._executeCommand(command, beforeCall, params, item, name, e);
                }
            }
        };

        document.addEventListener('keydown', this._keydownHandler);
    }

    _prepareItems(items) {
        if (Array.isArray(items)) {
            const types = ['text', 'address', 'list', 'todo', 'quote', 'dlist'];

            let customButtons = (this.params.extend) ? this.params.extend : {};
            let removeButtons = [];
            let dropdownType = 'dropdown';

            if (this.name === 'control') {
                dropdownType = 'control';
                let extendFromconfig = this.config.get('control.add');
                if (extendFromconfig) {
                    customButtons = Redactor.extend(true, {}, customButtons, extendFromconfig);
                }
                let extendRemoveFromconfig = this.config.get('control.hide');
                if (extendRemoveFromconfig) {
                    removeButtons = [...removeButtons, ...extendRemoveFromconfig];
                }
            }

            if (this.params.remove) {
                removeButtons = this.params.remove;
            }

            const resultButtons = this.app.ui.loadButtonsFromArray(items, customButtons, 'dropdown', removeButtons);
            const blockButtons = this.app.ui.buildBlockButtonsGetter(dropdownType, removeButtons);

            if (dropdownType === 'control') {
                const removeConfig = this.config.get(`control.hide`) || [];
                removeConfig.forEach(key => {
                    delete blockButtons[key];
                });
            }

            items = {...resultButtons, ...blockButtons};
            items = this._sortButtons(items);
        }

        return items;
    }

    _sortButtons(buttons) {
        const entries = Object.entries(buttons).map(([key, value]) => ({
            key,
            name: value.name || key,
            value,
            position: value.position
        }));

        const placed = [];

        const getIndex = (targetNames) =>
            placed.findIndex(item => targetNames.includes(item.name));

        const insert = (item) => {
            const pos = item.position;

            if (!pos) {
                placed.push(item);
            } else if (pos === 'first') {
                placed.unshift(item);
            } else if (pos === 'last') {
                placed.push(item);
            } else if (typeof pos === 'object') {
                const refList = Array.isArray(pos.after || pos.before)
                    ? (pos.after || pos.before)
                    : [pos.after || pos.before];

                const index = getIndex(refList);
                if (index !== -1) {
                    if (pos.after) {
                        placed.splice(index + 1, 0, item);
                    } else if (pos.before) {
                        placed.splice(index, 0, item);
                    } else {
                        placed.push(item);
                    }
                } else {
                    placed.push(item);
                }
            } else {
                placed.push(item);
            }
        };

        entries.forEach(item => {
            if (!item.position || item.position === 'first') insert(item);
        });

        entries.forEach(item => {
            if (!placed.some(i => i.name === item.name)) insert(item);
        });

        const result = {};
        placed.forEach((item, i) => {
            result[i] = item.value;
        });
        return result;
    }
}
class CommandPalette {
    constructor(app) {
        this.app = app;

        this.handleStr = '';
        this.triggers = [{ trigger: '/', builder: 'command.buildItems' }];
    }


    addTrigger(trigger) {
        this.triggers.push(trigger);
    }

    build(e) {
        const ks = this.app.keycodes;
        const key = e.which;
        const ctrl = e.ctrlKey || e.metaKey;
        const arrows = [ks.LEFT, ks.UP, ks.RIGHT, ks.DOWN];

        if (key === ks.ESC) {
            return;
        }

        if (ctrl || arrows.includes(key) || key === ks.SHIFT || key === ks.DELETE) return;

        const selection = new TextRange(this.app);
        const current = selection.getElement();
        if (current && current.closest && current.closest('a')) {
            return;
        }

        if (key === ks.SPACE) {
            this.hidePanelForce();
            return;
        }

        this.emit();
    }

    buildItems({ filter, panel }) {
        const utils = new Utils(this.app);
        const sectionNames = { add: 'Add', format: "Turn into" };
        const initialItems = {
            add: this.app.addbar.getItems(),
            format: this.app.format.getItems()
        };
        const items = {};

        let sections = 0;
        Object.entries(initialItems).forEach(([name, section]) => {
            const re = (filter && filter !== '') ? new RegExp(utils.escapeRegExp(filter), 'gi') : false;
            const sectionTitle = sectionNames[name];
            const sectionItems =  {};

            let size = 0;
            Object.entries(section).forEach(([key, btn]) => {
                if (!btn.getTitle() || !btn.isButton()) return;

                const title = btn.getTitleText();
                if (re && (key.search(re) === -1 && title.search(re) === -1)) return;

                btn.beforeCall = 'command.insertFromPanel';
                sectionItems[key] = btn;
                size++;
            });

            if (size > 0) {
                sections++;
                items[name] = { title: sectionTitle, name, items: sectionItems };
            }
        });

        return { items, size: sections };
    }

    emit() {
        const selection = new TextRange(this.app);
        const lookBehind = 50;
        const beforeText = selection.getText('before', lookBehind);

        for (let trigger of this.triggers) {
            const index = beforeText.lastIndexOf(trigger.trigger);
            if (index === -1) continue;

            const beforeTrigger = beforeText.slice(index + trigger.trigger.length);

            this.handleTrigger = trigger.trigger;
            this.handleStr = beforeTrigger.replace(/\uFEFF/g, '');
            this.fire(trigger);
            return;
        }

        this.hidePanelForce();
    }

    fire(trigger) {
        if (trigger.loader) {
            this.app.api(trigger.loader, { filter: this.handleStr, panel: true });
            return;
        }

        const { items, size } = this.app.api(trigger.builder, { filter: this.handleStr, panel: true });
        if (size === 0) {
            this.hidePanel();
        } else {
            this.showPanel(items);
        }
    }

    showPanel(items) {
        const scrollTop = this.app.page.getDoc().scrollTop();
        const selection = new TextRange(this.app);
        const pos = selection.getPosition();

        this.app.dropdown.create('panel', { items, panel: true, maxWidth: '328px' });
        this.app.dropdown.openAt({ y: (pos.bottom + scrollTop), x: pos.left });
    }

    hidePanel() {
        this.app.dropdown.close();
    }

    hidePanelForce() {
        this.hidePanel();
        this.handleStr = '';
    }

    insertFromPanel(params, button, name, e) {
        this.replaceTrigger();
        this.hidePanelForce();
    }

    replaceTrigger(replacement = '') {
        const trigger = this.handleTrigger;
        const marker = new Marker(this.app);
        marker.insert('start');

        const markerNode = marker.find('start');
        if (markerNode === false) return;

        const $marker = this.dom(markerNode);
        const current = markerNode.previousSibling;
        const re = new RegExp(trigger + this.handleStr + '$');

        let currentText = current.textContent.replace(/\uFEFF/g, '');
        currentText = currentText.replace(re, '');
        current.textContent = currentText;

        if (this.isHTMLReplacement(replacement)) {
            const caret = new Caret(this.app);
            const $replacement = this.dom(replacement);
            $marker.before($replacement);
            caret.set($replacement, 'after');
        } else {
            $marker.before(replacement);
        }

        marker.restore();
    }

    isHTMLReplacement(str) {
        return /<\/?[a-z][\s\S]*>/i.test(str.trim());
    }
}
/*jshint esversion: 6 */
class BlockModule {
    constructor(app) {
        this.app = app;

        // local
        this.instance = false;
        this.$block = false;
        this.tool = false;
    }

    create(html) {
        const instance = this.app.create('block.text');
        if (html) {
            instance.getBlock().html(html);
        }
        return instance;
    }

    createHtml(html) {
        return this.create(html).getOuterHtml();
    }

    trigger(mutation) {
        if (this.is() && (mutation.type === 'childlist' || mutation.type === 'characterData')) {
            const firstChild = this.instance.getBlock().get().firstChild;
            if (firstChild && firstChild.id === 'rx-selection-marker-start') {
                const caret = new Caret(this.app);
                firstChild.childNodes[0].textContent.trim();
                firstChild.replaceWith(...firstChild.childNodes);
                caret.set(this.instance.getBlock(), 'end');
                return;
            }
        }

        if (!this.is() || !this.instance.getPlaceholder()) return;
        if (this.instance.isEditable() && this.instance.isEmpty(false, true)) {
            this.instance.setEmpty(true);
        }

        if (mutation.type === 'childlist' || mutation.type === 'characterData') {
            this.instance.trigger(mutation);
        }
    }

    isTool() {
        return this.tool;
    }

    setTool(name) {
        this.tool = name;
        this.app.observer.trigger = name ? false : true;
        if (name) {
            this.unset();
        }
    }

    setNonEditable() {
        if (!this.is()) return;
        this.$block.attr('contenteditable', false);
        this.instance.setNoneditable(true);
    }

    clearNonEditable() {
        if (!this.is()) return;
        if (this.instance.isEditable()) {
            this.$block.attr('contenteditable', true);
        }
        this.instance.setNoneditable(false);
    }

    isNonEditable() {
        return this.is() ? this.instance.isNondeletable() : null;
    }

    is($el) {
        return $el ? this._isBlockActive($el) : this.get();
    }

    setParent(params) {
        if (!this.is()) return;

        this._closeUI();

        const type = (params && params.column) ? 'column' : 'force';
        const parent = this._getParentByParams(params);
        if (parent) {
            this.set(parent, type);
        }
    }

    set(el, caret, force) {
        if (!el || (force !== true && this._isBlockActive(el))) return;

        // Unset previous state
        this.app.editor.deselectAll();
        this.app.blocks.unset();
        this.unset();

        // Get instance
        this.instance = this._getInstance(el);
        if (!this.instance) return;

        // Noneditable check
        if (this.instance.isType('noneditable') && !this.config.is('noneditable.select')) {
            this.instance = false;
            return false;
        }

        // Handle column type or parent blocks
        if (this.instance.isType('column') && caret !== 'column') {
            this.instance = this.instance.getFirstBlockInstance();
            caret = 'start';
        } else if (this.instance.isParent()) {
            this.instance = this.instance.getParent();
        }

        // Set block and focus
        this.$block = this.instance.getBlock();
        this.$block.addClass('rx-block-focus');

        // Handle control focus
        if (this.config.is('block.outline') && this.config.is('control') && !this.instance.isFocusable() && this.instance.getControl()) {
            this.$block.addClass('rx-block-control-focus');
        }

        // Set caret
        this._setCaret(caret);

        // Build UI components
        this.app.toolbar.build();
        this.app.extrabar.build();
        this.app.control.build();
        this.app.path.build();

        // Broadcast block set event
        this.app.broadcast('block.set', { instance: this.instance });
    }

    unset() {
        if (!this.instance) return;

        // remove focus
        if (this.$block) {
            this.$block.removeClass('rx-block-focus rx-block-control-focus');
        }

        // reset
        this.instance = false;
        this.$block = false;
        this.setTool(false);

        // ui
        this.app.dropdown.close();
        this.app.control.close();
        this.app.context.close();
        this.app.path.build();

        // broadcast
        this.app.broadcast('block.unset');
    }

    get() {
        return this.instance;
    }

    setData(data) {
        if (!this.instance) return;
        this.instance.setData(data);
    }

    getData() {
        return (this.instance) ? this.instance.getData() : null;
    }

    unwrap() {
        if (!this.is() || !this.instance.isType(['layout', 'wrapper'])) return;

        this.app.dropdown.close();

        const $block = this.instance.getBlock();
        let type = this.instance.getType();
        let $first = $block.children().first();

        if (type === 'wrapper') {
            $block.unwrap();
        } else if (type === 'layout') {
            $first = $first.children().first();
            $block.find('[data-rx-type=column]').unwrap();
            $block.unwrap();
        }

        this.set($first, 'start');
        this.app.editor.build();
        this.app.broadcast('block.unwrap', { type: type });
    }

    remove(params) {
        if (!this.is()) return;

        this._closeUI();

        const type = this.instance.getType();
        this.app.broadcast('block.before.remove', { type: type, instance: this.instance });

        const defaults = { traverse: true };
        const settings = { ...defaults, ...params };
        const data = (type === 'image') ? this._getDataImage() : {};

        this.instance.remove({ traverse: settings.traverse });
        if (!settings.traverse) this.unset();

        if (type === 'image') {
            this.app.image.setImageState(this.instance, data, false);
            this.app.broadcast('image.remove', data);
        }

        if (type === 'embed') {
            this.app.broadcast('embed.remove', this.instance.getContent());
        }

        this.app.broadcast('block.remove', { type: type });
        if (this.app.editor.isEmpty()) {
            this.app.editor.setEmpty();
        }
    }

    change(instance, broadcast) {
        if (this.is()) {
            this.instance.change(instance, broadcast);
        }
    }

    insert(params) {
        if (this.is()) {
            return this.instance.insert(params);
        }
    }

    add(params, button, name) {
        this._closeUI();

        const insertion = new Insertion(this.app);
        const template = params?.template || null;
        let inserted;

        if (template) {
            inserted = insertion.insert({ html: template });
        } else {
            const newInstance = this.app.create(`block.${name}`);
            inserted = insertion.insert({ instance: newInstance, type: 'add' });
        }

        setTimeout(() => {
            this.app.broadcast('block.add', { inserted: inserted });
        }, 1);
        return inserted;
    }

    duplicate() {
        if (!this.is()) return;

        this._closeUI();

        // clone
        const clone = this.instance.duplicate();
        const newInstance = this.instance.insert({ instance: clone, position: 'after', caret: 'start', type: 'duplicate' });

        this.app.broadcast('block.duplicate', { instance: newInstance });
        return newInstance;
    }

    moveUp() {
        if (this.is()) {
            this.instance.move('up');
        }
    }

    moveDown() {
        if (this.is()) {
            this.instance.move('down');
        }
    }

    // Private methods

    _closeUI() {
        this.app.dropdown.close();
        this.app.ui.closeTooltip();
    }

    _getParentByParams(params) {
        if (params && params.cell) {
            return this.instance.getClosest('cell');
        } else if (params && params.column) {
            return this.instance.getClosest('column');
        } else {
            return this.instance.getClosest(['list', 'wrapper', 'layout', 'todo', 'table']);
        }
    }

    _getInstance(el) {
        return el && el.app ? el : this.dom(el).dataget('instance');
    }

    _getDataImage() {
        return {
            url: this.instance.getSrc(),
            id: this.instance.getId(),
            uid: this.instance.getDataImage()
        };
    }

    _isBlockActive(el) {
        el = el.$block ? el.$block : el;
        return this.instance && this.dom(el).get() === this.$block.get();
    }

    _setCaret(point) {
        if (point === 'skip') return;

        const listTypes = ['todo', 'list'];
        const utils = new Utils(this.app);
        const type = this.instance.getType();

        const isTypeInList = (list) => list.includes(type);
        const shouldSetFocus = (point === 'force' && isTypeInList(listTypes) || !point && isTypeInList(listTypes));

        if (isTypeInList(listTypes) && point === 'end') {
            this.instance.setCaret(point);
        } else if (point === 'column' || this.instance.isFocusable() || (this.instance.isInline() && !this.instance.isEditable())) {
            this._setFocus(type);
        } else if (shouldSetFocus) {
            this.setCaret();
        } else if (point && point !== 'force') {
            if (this._setSvgCaret(utils)) return;
            this.instance.setCaret(point);
        } else if (!point) {
            this._setSvgCaret(utils);
        }
    }

    _setSvgCaret(utils) {
        if (this.instance.isEditable()) {
            const $el = this.instance.getBlock();
            if ($el.text().trim() === '' && (utils.isOnlySvgContent($el) || utils.hasSvgAt($el, 'end'))) {
                this.instance.setCaret('end');
                return true;
            }
        }
    }

    _setFocus(type) {
        this.app.scroll.save();
        this.$block.attr('tabindex', '-1');
        this.$block.focus();

        if (type !== 'noneditable') {
            setTimeout(() => {
                const selection = new TextRange(this.app);
                selection.remove();
            }, 0);
        }

        this.app.scroll.restore();
    }
}
/*jshint esversion: 6 */
class BlockCollectionModule {
    constructor(app) {
        this.app = app;

        // local
        this.selected = [];
        this.focusClass = 'rx-block-meta-focus';
    }

    build() {
        const $editor = this.app.editor.getLayout();
        $editor.find('[data-rx-first-level]').removeAttr('data-rx-first-level');
        $editor.children('[data-rx-type]').attr('data-rx-first-level', true);
    }

    trigger(mutation) {
        if (!this.is()) return;

        if (mutation.type === 'childlist' || mutation.type === 'characterData') {
            this.get({ selected: true, instances: true }).forEach(instance => {
                instance.trigger(mutation);
            });
        }
    }

    is() {
        return this.selected.length > 0;
    }

    set(blocks) {
        this.unset();
        this.selected = Array.isArray(blocks) ? blocks : blocks.all();

        this.selected.forEach(block => {
            this.dom(block).addClass(this.focusClass);
        });

        this.app.path.build();
    }

    setInstances(instances) {
        this.unset();

        let blocks = [],
            $block;

        this.selected = instances.map(instance => {
            const $block = instance.getBlock();
            $block.addClass(this.focusClass);
            return $block;
        });

        this.app.path.build();
    }

    unset() {
        this.selected = [];
        this.app.editor.getLayout().find('.' + this.focusClass).removeClass(this.focusClass);
        this.app.block.setTool(false);
    }

    has(filter) {
        return this.count(filter) !== 0;
    }

    count(filter) {
        return this.get(filter).length;
    }

    get(filter = {}) {
        let $blocks = this.app.editor.getLayout().find('[data-rx-type]');

        if (filter.selected) $blocks = $blocks.filter('.' + this.focusClass);
        if (filter.firstLevel) $blocks = $blocks.filter('[data-rx-first-level]');
        if (filter.firstLevel === false) $blocks = $blocks.not('[data-rx-first-level]');
        if (filter.type) $blocks = $blocks.filter(this._getTypesSelector(filter.type));
        if (filter.editable) $blocks = $blocks.filter('[contenteditable=true]');
        if (filter.except) $blocks = $blocks.not(this._getTypesSelector(filter.except));
        if (filter.first) $blocks = $blocks.first();
        if (filter.last) $blocks = $blocks.last();

        // instances
        if (filter.instances) {
            const instances = [];
            $blocks.each($node => {
                instances.push($node.dataget('instance'));
            });

            return (filter.first || filter.last) ? instances[0] : instances;
        }

        return $blocks;
    }

    removeAll() {
        if (this.app.editor.isSelectAll()) {
            this._removeAllSelected();
            return this.get({ first: true });
        }

        this.get({ selected: true }).each($node => {
            $node.closest('[data-rx-first-level]').remove();
        });
    }

    remove(traverse) {
        if (this.app.editor.isSelectAll()) {
            this._removeAllSelected();
            return;
        }

        const $blocks = this.get({ selected: true });
        const $last = $blocks.last();
        const $next = this._getNextElement($last);


        $blocks.get().reverse().forEach(node => this._removeSelected(node));

        // fill empty
        this.get({ selected: true, type: ['cell', 'column'], instances: true })
            .forEach(instance => this._fillEmptyBlocks(instance));

        if (traverse && $next.length !== 0) {
            this.app.block.set($next, 'start');
        } else {
            this.app.context.close();
        }
    }

    // Private methods

    _removeAllSelected() {
        this.app.editor.setEmpty();
        this.app.editor.deselectAll();
        this.app.editor.setFocus('start', false);
    }

    _removeSelected(node) {
        const $node = this.dom(node);
        const instance = $node.dataget('instance');
        const type = instance.getType();
        const ignoreNoneditable = type === 'noneditable' && !this.config.is('noneditable.remove');
        const ignoreTypes = ['cell', 'row', 'column', 'figcaption'];

        if (!ignoreNoneditable && ignoreTypes.indexOf(type) === -1) {
            const remove = this._shouldRemoveInstance(type, instance);
            if (remove) instance.remove({ traverse: false });
        }
    }

    _shouldRemoveInstance(type, instance) {
        const types = ['wrapper', 'layout', 'table', 'todo', 'list'];
        const emptyTypes = ['todo', 'list', 'wrapper'];
        if (types.includes(type)) {
            if (type === 'table' && this._isTableSelected($node)) {
                return true;
            }
            if (emptyTypes.includes(type) && instance.isEmpty(true)) {
                return true;
            }
            if (type === 'layout' && this._isLayoutSelected(instance.getBlock(), instance)) {
                return true;
            }
            return false;
        }
        return true;
    }

    _fillEmptyBlocks(instance) {
        if (instance.isEmpty()) {
            const emptyInstance = this.app.block.create();
            instance.getBlock().append(emptyInstance.getBlock());
        }
    }

    _getTypesSelector(type) {
        return Array.isArray(type)
            ? '[data-rx-type=' + type.join('],[data-rx-type=') + ']'
            : `[data-rx-type=${type}]`;
    }

    _getNextElement($last) {
        const instance = $last.dataget('instance');
        const type = instance.getType();
        const types = ['todoitem', 'listitem'];
        const closest = instance.getClosest(['cell', 'column']);

        let $next = $last.nextElement();
        if (types.includes(type) && instance.isLastElement()) {
            $next = instance.getParent().getBlock().nextElement();
        } else if (closest && closest.isLastElement()) {
            $next = closest.getParent().getBlock().nextElement();
        }

        return $next;
    }

    _isLayoutSelected($node, instance) {
        const columns = instance.getColumns();
        const columnsSelectedSize = columns.filter(column => column.getBlock().hasClass(this.focusClass) && column.isEmpty()).length;

        return (columns.length === columnsSelectedSize);

    }

    _isTableSelected($node) {
        const rows = $node.find('tr');
        return rows.length === rows.filter(`.${this.focusClass}`).length;
    }
}
/*jshint esversion: 6 */
class FormatModule {
    constructor(app) {
        this.app = app;
    }

    init() {
        this.popupManager = new FormatPopupManager(this.app);
    }

    getItems() {
        return this.popupManager.getItems();
    }

    popup(e, button) {
        this.popupManager.popup(e, button);
    }

    remove(name) {
        this.popupManager.remove(name);
    }

    set(params, button, name) {
        if (this.app.block.isTool()) return;
        this.app.dropdown.close();

        const selection = new TextRange(this.app);
        const instance = this.app.block.get();
        const instances = this._getInstances(selection, instance);

        this.params = params || {};
        this.name = name;
        this.tag = this._buildTag();
        this.type = this._buildType();
        this.multiple = instances.length > 1;
        this.isSelectAll = this.app.editor.isSelectAll();
        this.$editor = this.app.editor.getLayout();
        this.collection = [];

        if (instances.length) {
            // checks if one of the instances is nondeletable
            const formatting = !instances.some(item => item.isNondeletable());
            if (!formatting) return;

            this.app.broadcast('format.before.set', { instances: instances });
            this._format(instances);
            this.app.scroll.restore();
        }
    }

    // Private methods

    _getInstances(selection, instance) {
        if (!this.app.editor.isSelectAll() && selection.isCollapsed()) {
            return instance ? [instance] : [];
        }

        if (this.app.blocks.is()) {
            return this.app.blocks.get({ selected: true, instances: true });
        }

        return instance ? [instance] : [];
    }

    _format(instances) {
        const marker = new Marker(this.app);

        // Initialize converter
        this.converter = new FormatConverter(this.app, this);

        if (!this.isSelectAll) marker.save();

        instances.forEach(instance => this._processInstance(instance));

        this._convertFormatted();
        this._combineSelected('list');
        this._combineSelected('todo');

        setTimeout(() => this._buildConverted(marker), 0);
    }

    _processInstance(instance) {
        const types = ['text', 'heading', 'address', 'list', 'listitem', 'todo', 'todoitem', 'quote', 'pre'];
        if (types.indexOf(instance.getType()) === -1) return;

        const hasSameTag = this._hasSameTag(instance);
        const newInstance = this._processNewInstance(instance, hasSameTag);
        if (hasSameTag && instance.isType(this.type)) {
            this.collection.push(instance);
        }

        if (newInstance) {
            Array.isArray(newInstance) ? this.collection.push(...newInstance) : this.collection.push(newInstance);
        }
    }

    _processNewInstance(instance, hasSameTag) {
        if (this._shouldConvertToText(instance, hasSameTag)) return this.converter.convertToText(instance);
        if (instance.isType(['text', 'heading', 'address'])) return this.converter.convertText(this.type, instance);
        if (instance.isType('listitem')) return this._processConvertListItem(instance, hasSameTag);
        if (instance.isType('todoitem')) return this.converter.convertTodoItem(this.type, instance);
        if (instance.isType(['pre', 'quote'])) return this.converter.convertPreQuote(this.type, instance);
        if (instance.isType('list')) return this.converter.convertList(this.type, instance);
        if (instance.isType('todo')) return this.converter.convertTodo(this.type, instance);
        if (this.isSelectAll) return this._processAllSelected(instance, hasSameTag);
    }

    _processAllSelected(instance, hasSameTag) {
        if (['heading', 'text'].includes(this.type) && instance.isType(['list', 'todo'])) {
            return this.converter.convertAllSelected(instance);
        } else if (this.type === 'list' && !hasSameTag && instance.isType('list')) {
            return this.converter.convertAllSelectedList(instance);
        }
    }

    _processConvertListItem(instance, hasSameTag) {
        let type = (!hasSameTag && this.listType) ? 'list' : this.type;
        let $parentTop = instance.getParentTop();
        if ($parentTop.length && $parentTop.tag(this.tag)) {
            type = 'text';
        }

        return this.converter.convertListItem(type, instance);
    }

    _shouldConvertToText(instance, hasSameTag) {
        return !this.multiple && hasSameTag && !this._isParams() && ['heading', 'address'].includes(this.type);
    }

    _convertFormatted() {
        const selectors = {
            '.rx-format-todo-to-listitem': 'convertFormattedTodoToList',
            '.rx-format-todo-to-text': 'convertFormattedTodoToText',
            '.rx-format-list-to-text': 'convertFormattedListToText',
            '.rx-format-listitem-to-todo': 'convertFormattedListToTodo',
        };

        Object.entries(selectors).forEach(([selector, method]) => {
            this.$editor.find(selector).each($node => this.converter[method]($node));
        });
    }

    _buildConverted(marker) {
        let selection;
        if (!this.isSelectAll) {
            marker.restore();
            selection = new TextRange(this.app);
            this._setParams(selection);
            this._setFocus(selection, false);
        } else {
            selection = new TextRange(this.app);
            this._setParams(selection);
            this._finalizeSelection();
        }
    }

    _setFocus(selection, focus = true) {
        let nodes = this.dom([]);

        if (this.multiple) {
            const blocks = selection.getNodes({ type: 'block', partial: true });
            this.app.blocks.set(blocks);
            nodes = blocks;
        } else {
            let block = this.collection[0];
            if (block.isType('list') || block.isType('todo')) {
               block = block.getFirstItemInstance();
            }

            let pointer = block.isEmpty && block.isEmpty() ? 'start' : false;
            pointer = focus ? pointer : 'skip';
            this.app.block.set(block, pointer);

            nodes = block.getBlock();
        }

        this.app.editor.build();
        this.app.broadcast('format.set', { $nodes: this.dom(nodes), name: this.name });
        if (!selection.isCollapsed()) this.app.context.open();
    }

    _finalizeSelection() {
        this.app.editor.deselectAll();
        this.app.editor.build();
        this.app.editor.selectAll(false, false);
        const $blocks = this.app.blocks.get();
        this.app.broadcast('format.set', { $nodes: $blocks, name: this.name });
    }

    _setParams(selection) {
        if (!selection.is()) return;

        const blocks = selection.getNodes({ tags: [this.tag], partial: true });
        const inspector = new ElementInspector(this.app);
        const { classParamSize, styleParamSize, attrsParamSize } = this._checkParams(blocks, inspector);

        if (blocks.length) {
            this._setClass(blocks, classParamSize);
            this._setStyle(blocks, styleParamSize);
            this._setAttrs(blocks, attrsParamSize);
        }
    }

    _checkParams(blocks, inspector) {
        let classParamSize = 0;
        let styleParamSize = 0;
        let attrsParamSize = 0;

        blocks.forEach(block => {
            const $block = this.dom(block);

            if (this.params.classname && $block.hasClass(this.params.classname)) classParamSize++;
            if (this.params.style && inspector.hasStyle($block, this.params.style)) styleParamSize++;
            if (this.params.attrs && inspector.hasAttrs($block, this.params.attrs)) attrsParamSize++;
        });

        return { classParamSize, styleParamSize, attrsParamSize };
    }

    _setAttrs(blocks, size) {
        if (!this.params.attrs) return;

        const obj = this.params.attrs;
        this.dom(blocks).each($node => {
            const instance = $node.dataget('instance');
            if (instance) {
                blocks.length === size ? this._removeAttrs(instance, obj) : this._setAttrsForInstance(instance, obj);
            }
        });
    }

    _removeAttrs(instance, attrs) {
        Object.keys(attrs).forEach(key => instance.removeAttr(key));
    }

    _setAttrsForInstance(instance, attrs) {
        Object.entries(attrs).forEach(([key, val]) => instance.setAttr(key, val));
    }

    _setStyle(blocks, size) {
        if (!this.params.style) return;

        const cache = new CleanerCache(this.app);
        const obj = { ...this.params.style };

        if (blocks.length === size) {
            Object.keys(obj).forEach(key => (obj[key] = ''));
        }

        this.dom(blocks).css(obj).each($node => {
            cache.cacheElementStyle($node);
            if ($node.attr('style') === '') $node.removeAttr('style');
        });
    }

    _setClass(blocks, size) {
        if (!this.params.classname) return;
        const func = blocks.length === size ? 'removeClass' : 'addClass';
        this.dom(blocks)[func](this.params.classname);
    }

    _combineSelected(type) {
        const selection = new TextRange(this.app);
        if (selection.is()) {
            const blocks = selection.getNodes({ types: [type], partial: true });
            blocks.forEach(block => this._combineBlock(block, type));
        }
    }

    _combineBlock(block, type) {
        const $el = this.dom(block);
        const instance = $el.dataget('instance');
        if (instance) {
            const prev = instance.getPrev(type);
            if (prev && prev.getTag() === instance.getTag()) {
                prev.getBlock().append(instance.getBlock().children());
                instance.remove();
            }
        }
    }

    _buildTag() {
        const tagsMap = {
            'numberedlist': 'ol',
            'bulletlist': 'ul',
            'text': this.config.get('markup')
        };
        return tagsMap[this.name] || this.params.tag || this.name;
    }

    _buildType() {
        if (['text', 'p', 'div'].includes(this.tag)) return 'text';
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(this.tag)) return 'heading';
        if (['ol', 'ul'].includes(this.tag)) return 'list';
        return this.params.type || this.name;
    }

    _isParams() {
        return Boolean(this.params.style || this.params.classname || this.params.attrs);
    }

    _hasSameTag(instance) {
        const tag = instance.getTag();
        return (
            (instance.isType('quote') && this.tag === 'quote') ||
            (instance.isType(['todo', 'todoitem']) && this.tag === 'todo') ||
            tag === this.tag
        );
    }
}
class FormatPopupManager {
    constructor(app) {
        this.app = app;
        this.config = app.config;
        this.dropdown = app.dropdown;
        this.observer = app.observer;
        this.ui = app.ui;

        // local
        this.removeButtons = [];
    }

    getItems() {
        const buttons = [...this.config.get('popups.format')];
        const formatItems = this._getFormatItemsWithCommands();
        return this.ui.loadButtons(buttons, formatItems, 'format', false, this.removeButtons);
    }

    popup(e, button) {
        const buttons = [...this.config.get('popups.format')];
        const formatItems = this._getFormatItemsWithCommands();
        const activeKeys = this.observer.getKeys();
        this.dropdown.create('format', {
            items: buttons,
            extend: formatItems,
            keys: activeKeys,
            remove: this.removeButtons,
            type: 'formatbar'
        });
        this.dropdown.open(e, button);
    }

    remove(name) {
        if (Array.isArray(name)) {
            this.removeButtons.push(...name);
        } else {
            this.removeButtons.push(name);
        }
    }

    // Private methods

    _getFormatItemsWithCommands() {
        const formatItems = this.config.get('formatItems');
        if (formatItems) {
            for (let key in formatItems) {
                formatItems[key].command = 'format.set';
            }
        }
        return formatItems;
    }

}
class FormatConverter {
    constructor(app, format) {
        this.app = app;
        this.format = format;
        this.config = app.config;

        // local
        this.tag = format.tag;
        this.type = format.type;
        this.collection = format.collection;

        // Initialize utilities
        this.replacer = new FormatReplacer(this.app, format);
    }

    convertAllSelectedList(instance) {
        const $el = instance.getBlock();
        return this.replacer.replaceListToListElement('list', this.tag, $el);
    }

    convertAllSelected(instance) {
        const $block = instance.getBlock();
        const blocks = [];

        $block.children().each($node => {
            const item = $node.dataget('instance');
            const content = item.getContent();
            const blockType = this.type === 'text' ? 'block.text' : 'block.heading';
            const blockOptions = this.type === 'text' ? { content } : { level: this.tag.replace('h', ''), content };
            const block = this.app.create(blockType, blockOptions);

            item.getBlock().after(block.getBlock());
            item.remove();

            blocks.push(block);
        });

        $block.unwrap();

        return blocks;
    }

    convertFormattedListToText($node) {
        this._convertListOrTodoToText($node, 'list');
    }

    convertFormattedTodoToText($node) {
        this._convertListOrTodoToText($node, 'todo');
    }

    convertFormattedListToTodo($node) {
        this._convertTodoList($node, 'list', 'todo', 'todoitem', 'rx-format-listitem-to-todo');
    }

    convertFormattedTodoToList($node) {
        this._convertTodoList($node, 'todo', 'list', 'listitem', 'rx-format-todo-to-listitem', this.tag);
    }

    convertToText(instance) {
        return this.replacer.replaceTo('text', this.config.get('markup'), instance);
    }

    convertText(type, instance) {
        let replacers = {
            heading: () => this.replacer.replaceTo('heading', this.tag, instance),
            text: () => this.replacer.replaceTo('text', this.config.get('markup'), instance),
            address: () => this.replacer.replaceTo('text', this.config.get('markup'), instance),
            list: () => this.replacer.replaceToList(instance),
            todo: () => this.replacer.replaceToTodo(instance),
            quote: () => this.replacer.replaceToQuote(instance)
        };

        return replacers[type]();
    }

    convertTodoItem(type, instance) {
        let replacers = {
            heading: () => this.replacer.replaceListTodoToText('heading', 'todo', instance),
            text: () => this.replacer.replaceListTodoToText('text', 'todo', instance),
            list: () => this.replacer.replaceTodoToList(instance),
            todo: () => instance
        };

        return replacers[type]();
    }

    convertPreQuote(type, instance) {
        let replacers = {
            heading: () => this.replacer.replaceToHeading(instance),
            text: () => this.replacer.replaceToText(instance),
            list: () => this.replacer.replaceToList(instance),
            todo: () => this.replacer.replaceToTodo(instance),
            quote: () => this.replacer.replaceToQuote(instance)
        };

        return replacers[type]();
    }

    convertList(type, instance) {
        let items = instance.getItems();
        if (type === 'text' || type === 'heading') {
            this._convertItemsToTextOrHeading(items, instance, type);
        } else if (type === 'list') {
            return this.replacer.replaceListToList(this.tag, instance);
        } else if (type === 'quote') {
            this._convertItemsToQuote(items, instance);
        } else if (type === 'todo') {
            this._convertItemsToTodoList(items, instance);
        }
    }

    convertTodo(type, instance) {
        let items = instance.getItems();
        if (type === 'text' || type === 'heading') {
            this._convertItemsToTextOrHeading(items, instance, type, true);
        } else if (type === 'quote') {
            this._convertItemsToQuote(items, instance);
        } else if (type === 'list') {
            this._convertItemsToList(items, instance);
        }
    }

    convertListItem(type, instance) {
        if (type === 'text' && !instance.hasParentList()) {
            return this.replacer.replaceListTodoToText('text', 'list', instance);
        }
        else if (type === 'heading' && !instance.hasParentList()) {
            return this.replacer.replaceListTodoToText('heading', 'list', instance);
        }
        else if (type === 'todo') {
            const block = this.app.create('block.todoitem', { content: instance.getContent() });
            const $block = block.getBlock();

            instance.getBlock().after($block);
            instance.remove();

            $block.closest('[data-rx-type=list]').addClass('rx-format-listitem-to-todo');

            return block;
        }
        else if (type === 'list') {
            return this.replacer.replaceListToList(this.tag, instance);
        }
    }


    // Private methods

    _convertItemsToTextOrHeading(items, instance, type, mapContent = false) {
        let first, block;
        for (let i = 0; i < items.length; i++) {
            const content = mapContent ? items[i].content : items[i];
            block = (type === 'text')
                ? this.app.create('block.text', { content: content })
                : this.app.create('block.heading', { level: this.tag.replace('h', ''), content: content });

            if (i === 0) first = block;
            instance.getBlock().before(block.getBlock());
        }

        if (first) {
            this.app.block.set(first.getBlock(), 'start');
        }
        instance.remove();
    }

    _convertItemsToQuote(items, instance) {
        let str = items.map(item => item.content || item).join('');
        let block = this.app.create('block.quote', { content: str });
        instance.getBlock().before(block.getBlock());
        this.app.block.set(block.getBlock(), 'start');
        instance.remove();
    }

    _convertItemsToList(items, instance) {
        let block = this.app.create('block.list', { numbered: (this.tag === 'ol') });
        instance.getBlock().before(block.getBlock());
        block.setEmpty();

        items.forEach(item => {
            let listItem = this.app.create('block.listitem', { content: item.content || item });
            block.getBlock().append(listItem.getBlock());
        });

        this.app.block.set(block.getBlock(), 'start');
        instance.remove();
    }

    _convertItemsToTodoList(items, instance) {
        let block = this.app.create('block.todo');
        instance.getBlock().before(block.getBlock());
        block.setEmpty();

        items.forEach(item => {
            let todoItem = this.app.create('block.todoitem', { content: item.content || item });
            block.getBlock().append(todoItem.getBlock());
        });

        this.app.block.set(block.getBlock(), 'start');
        instance.remove();
    }

    _convertTodoList($node, fromType, toType, itemType, removeClass, tag = null) {
        const $nodes = $node.find('li');
        const currentSize = $nodes.length;
        const targetSize = $node.find(`[data-rx-type=${itemType}]`).length;
        let block;

        if (currentSize === targetSize) {
            if (tag) {
                $node = $node.replaceTag(tag);
            }
            $node.removeAttr('data-rx-type');
            $node.children().removeAttr('data-rx-type');
            block = this.app.create(`block.${toType}`, $node);

            const instance = $node.dataget('instance');
            if (instance && fromType === 'todo') {
                block.setAttrs(instance.getAttrs());
            }

            this.collection.push(block);
        } else {
            const $newEl = this._findConvertedItem(fromType, toType, itemType, $node);

            const $next = $newEl.nextElement();
            if ($next?.attr('data-rx-type') === fromType && $next.get().children.length === 0) {
                $next.remove();
            }
        }

        $node.removeClass(removeClass);
    }

    _convertListOrTodoToText($node, type) {
        const $nodes = $node.find('li');

        if ($nodes.length === 0) {
            $node.unwrap();
            return;
        }

        const $newEl = this._findConvertedText(type, $node);
        const $next = $newEl.nextElement();

        if ($next?.attr('data-rx-type') === type && $next.get().children.length === 0) {
            $next.remove();
        }
        $newEl.unwrap();
        $node.removeClass('rx-format-todo-to-text');
    }

    _findConvertedItem(type, newType, itemType, $node) {
        const selector = `[data-rx-type=${itemType}]`;
        let first = $node.find(selector).first().prevElement().get();
        let block, $newEl;

        if (first) {
            $newEl = $node.cloneEmpty();
            if (newType === 'list') {
                $newEl = $newEl.replaceTag(this.tag);
            }
            $node.after($newEl);
            block = this.app.create(`block.${newType}`, $newEl);
            this.collection.push(block);

            while (first.nextSibling) {
                $newEl.append(first.nextSibling);
            }
        } else {
            $newEl = $node;
            if (newType === 'list') {
                $newEl = $newEl.replaceTag(this.tag);
            }
            block = this.app.create(`block.${newType}`, $newEl);
            this.collection.push(block);
        }

        this._appendNextSiblings(type, $node, $newEl, selector);

        return $newEl;
    }

    _findConvertedText(type, $node) {
        const selector = '[data-rx-type=text],[data-rx-type=heading]';
        let first = $node.find(selector).first().prevElement().get();
        let $newEl;

        if (first) {
            $newEl = $node.cloneEmpty();
            $newEl = $newEl.replaceTag(this.tag);
            $node.after($newEl);

            while (first.nextSibling) {
                $newEl.append(first.nextSibling);
            }
        }  else {
            $newEl = $node;
        }

        this._appendNextSiblings(type, $node, $newEl, selector);

        return $newEl;
    }

    _appendNextSiblings(type, $node, $newEl, selector) {
        let last = $newEl.find(selector).last().get();

        if (last) {
            const $newEl2 = $node.cloneEmpty();
            $newEl.after($newEl2);
            this.app.create(`block.${type}`, $newEl2);

            while (last.nextSibling) {
                $newEl2.append(last.nextSibling);
            }
        }
    }
}
class FormatReplacer {
    constructor(app, format) {
        this.app = app;

        // local
        this.tag = format.tag;
    }

    replaceToList(instance) {
        return this._replaceToListOrTodo(instance, 'list', { numbered: (this.tag === 'ol') });
    }

    replaceToTodo(instance) {
        return this._replaceToListOrTodo(instance, 'todo');
    }

    replaceToQuote(instance) {
        return this._replaceToBlock(instance, 'quote', { content: instance.getPlainText() });
    }

    replaceToHeading(instance) {
        return this._replaceToBlock(instance, 'heading', { level: this.tag.replace('h', ''), content: instance.getContent() });
    }

    replaceToText(instance) {
        return this._replaceToBlock(instance, 'text', { content: instance.getContent() });
    }

    replaceListTodoToText(mode, type, instance) {
        const content = instance.getContent(true);
        const blockType = mode === 'text' ? 'block.text' : 'block.heading';
        const blockOptions = mode === 'text' ? { content } : { level: this.tag.replace('h', ''), content };
        const block = this.app.create(blockType, blockOptions);
        const $block = block.getBlock();
        const $items = instance.getBlock().find('li');

        instance.getBlock().after($block);
        $items.each($node => {
            const itemInstance = $node.dataget('instance');
            const itemBlockType = mode === 'text' ? 'block.text' : 'block.heading';
            const itemBlockOptions = mode === 'text' ? { content: itemInstance.getContent(true) } : { level: this.tag.replace('h', ''), content: itemInstance.getContent(true) };
            const itemBlock = this.app.create(itemBlockType, itemBlockOptions);
            $block.after(itemBlock.getBlock());
        });

        instance.remove();
        $block.closest('[data-rx-type=' + type + ']').addClass('rx-format-' + type + '-to-text');

        return block;
    }

    replaceTodoToList(instance) {
        const content = instance.getContent();
        const block = this.app.create('block.listitem', { content: content });
        const $block = block.getBlock();

        instance.getBlock().after($block);
        instance.remove();
        $block.closest('[data-rx-type=todo]').addClass('rx-format-todo-to-listitem');

        return block;
    }

    replaceListToList(tag, instance, elm) {
        const $el = instance.isType('listitem') ? instance.getParentTop() : instance.getBlock();
        if (!$el.tag(tag)) {
            return this.replaceListToListElement('list', tag, $el, elm);
        }
    }

    replaceListToListElement(type, tag, $el, elm) {
        const instance = $el.dataget('instance');
        const attrs = instance ? instance.getAttrs() : null;
        const $newBlock = $el.replaceTag(tag);

        $newBlock.removeAttr('data-rx-type');
        $newBlock.children().removeAttr('data-rx-type');

        const block = this._parseInstance(type, $newBlock, attrs);
        $newBlock.find('ol, ul').each($list => {
            this.replaceListToListElement(type, tag, $list, elm);
        });

        return block;
    }

    replaceTo(newType, tag, instance, elm) {
        if (instance.getTag() === tag) return;

        const $el = instance.getBlock();
        let attrs = instance.getAttrs();

        // replace
        const $newBlock = $el.replaceTag(tag);
        $newBlock.removeAttr('data-rx-type class');

        // breakline fix
        if (newType !== 'text') {
            $newBlock.removeAttr('data-rx-tag');
        }

        return this._parseInstance(newType, $newBlock, attrs);
    }

    // Private methods

    _parseInstance(type, $newBlock, attrs) {
        const block = this.app.create('block.' + type, $newBlock);
        block.setAttrs(attrs);

        return block;
    }

    _replaceToListOrTodo(instance, type, options = {}) {
        const remover = new CleanerRemover(this.app);
        let content = instance.getContent();
        content = remover.removeBlockTags(content);

        let block = this.app.create('block.' + type, options);
        block.getFirstItemInstance().setContent(content);

        block = this._setDataStyle(instance, block);
        this._insertAfterAndRemove(instance, block);

        return block;
    }

    _replaceToBlock(instance, type, options = {}) {
        let block = this.app.create('block.' + type, options);

        block = this._setDataStyle(instance, block);
        this._insertAfterAndRemove(instance, block);

        return block;
    }

    _setDataStyle(instance, block) {
        const dataStyle = instance.getBlock().attr('data-rx-style-cache');
        if (dataStyle) {
            block.getBlock().attr('style', dataStyle);
        }

        return block;
    }

    _insertAfterAndRemove(instance, block) {
        instance.getBlock().after(block.getBlock());
        instance.remove();
    }
}
class EmbedManager {
    constructor(app) {
        this.app = app;
        this.ampRegex = '(\\b\\w+="[^"]*)&amp;([^"]*")';
    }

    observe(obj, name) {
        if (!this.config.is('embed')) return false;

        const instance = this.app.block.get();
        if (instance && instance.isType('embed')) {
             obj.command = 'embed.edit';
        }

        return obj;
    }

    build(scripts) {
        scripts ? this._callScripts(scripts) : this._findScripts();
    }

    popup(e, button) {
        const form = this.app.create('form', {
            items: {
                embed: { type: 'textarea', placeholder: '## embed.description ##', rows: 6 },
                caption: { type: 'input', placeholder: '## embed.caption ##' },
                flex: {
                    responsive: { type: 'checkbox', text: '## embed.responsive-video ##', auto: true },
                    insert: { type: 'button', text: `## buttons.insert ##`, command: 'embed.create', role: 'primary' }
                }
            }
        });

        if (this.config.is('embed.responsive')) {
            form.getInput('responsive').attr('checked', true);
        }

        this.app.dropdown.create('embed', { form, width: '320px', focus: 'embed' });
        this.app.dropdown.open(e, button);

        this._buildCodemirror(form);
    }

    edit(params, button, name, e) {
        const instance = this.app.block.get();
        if (!instance) return;

        const data = {
            embed: instance.getContent().replace(new RegExp(this.ampRegex, 'g'), '$1&$2'),
            caption: instance.getCaption(),
            responsive: instance.isResponsive()
        };

        const form = this.app.create('form', {
            data,
            items: {
                embed: { type: 'textarea', placeholder: '## embed.description ##', rows: 6 },
                caption: { type: 'input', placeholder: '## embed.caption ##' },
                flex: {
                    responsive: { type: 'checkbox', text: '## embed.responsive-video ##', auto: true },
                    save: { type: 'button', text: `## buttons.save ##`, command: 'embed.save', role: 'primary' }
                }
            }
        });

        this.app.dropdown.create('embed', { form, width: '320px', focus: 'embed' });
        this.app.dropdown.open(e, button);

        this._buildCodemirror(form);
    }

    create(stack) {
        this.app.dropdown.close();
        this.insert(stack.getData());
    }

    insert(data) {
        const code = this._getEmbedCode(data);
        if (code === '') return;

        const instance = this._createInstance(data, code);
        const insertion = new Insertion(this.app);

        insertion.insert({ instance: instance });
        this.app.broadcast('embed.insert', { content: code, instance });

        return instance;
    }

    save(stack) {
        this.app.dropdown.close();
        this.update(stack.getData());
    }

    get() {
        const instance = this.app.block.get();
        return instance && instance.isType('embed') ? instance : null;
    }

    update(data) {
        const current = this.app.block.get();
        const code = this._getEmbedCode(data);
        if (code === '') {
            this.app.block.remove();
            return null;
        }

        const instance = this._createInstance(data, code, current);
        if (this._isNeedToChange(data, instance, current)) {
            this.app.block.change(instance);
            this.app.broadcast('embed.change', { content: code, instance });
        }

        return instance;
    }

    remove() {
        this.app.dropdown.close();
        this.app.block.remove();
    }

    // Private methods

    _buildCodemirror(stack) {
        const $input = stack.getInput('embed');
        this.app.codemirror.create({ el: $input, height: '200px', focus: true });
    }

    _getEmbedCode(data) {
        const sanitizer = new Sanitizer(this.app);
        const content = data.embed !== undefined ? data.embed : data.content;

        let code = content.trim();
        code = this.app.codemirror.val(code);
        code = this._removeScript(code);
        code = sanitizer.sanitize(code);
        code = (!this._isHtmlString(code) && code !== '') ? this._parseUrl(code) : code;

        return code;
    }

    _isHtmlString(str) {
        return /^\s*<(\w+|!)[^>]*>/.test(str);
    }

    _isFigure(str) {
        return /^<figure/.test(str);
    }

    _isNeedToChange(data, instance, current) {
        return (
            current.getContent() !== instance.getContent() ||
            data.responsive !== current.isResponsive() ||
            data.caption !== current.getCaption()
        );
    }

    _removeScript(code) {
        if (!this.config.is('embed.script')) {
            const remover = new CleanerRemover(this.app);
            code = remover.removeTagsWithContent(code, ['script']);
        }
        return code;
    }

    _parseUrl(url) {
        const iframeStart = '<iframe width="560" height="315" src="';
        const iframeEnd = '" frameborder="0" allowfullscreen></iframe>';
        const mp4video = this.config.get('regex.mp4video');
        const youtube = this.config.get('regex.youtube');
        const vimeo = this.config.get('regex.vimeo');

        let parsed;

        if (url.match(mp4video)) {
            return url.replace(mp4video, (src) => `<video controls src="${src}"></video>`);
        }
        else if (url.match(youtube)) {
            const ytBase = url.search('youtube-nocookie.com') !== -1 ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
            return iframeStart + url.replace(youtube, ytBase + '/embed/$1') + iframeEnd;
        }
        else if (url.match(vimeo)) {
           return iframeStart + url.replace(vimeo, 'https://player.vimeo.com/video/$2') + iframeEnd;
        }

        return url;
    }

    _createInstance(data, code, current) {
        code = code.replace(new RegExp(this.ampRegex, 'g'), '$1&$2');

        let $figure;
        if (current) {
            const figure = current.duplicateEmpty();
            $figure = figure.getBlock().html(code);
        }
        else {
            $figure = (this._isFigure(code)) ? code : '<figure>' + code + '</figure>';
            $figure = this.dom($figure);
        }

        return this.app.create('block.embed', $figure, { caption: data.caption, responsive: data.responsive });
    }

    _findScripts() {
        const scripts = this.app.editor.getLayout().find('[data-rx-type=embed]').find('script').all();
        this.build(scripts);
    }

    _callScripts(scripts) {
        scripts.forEach((script, index) => {
            if (script.src) {
                const src = script.src;
                const $script = this.dom('<script>').attr({ src, async: true, defer: true });

                this.app.page.getDoc().find(`head script[src="${src}"]`).remove();

                $script.on('load', () => {
                    if (src.includes('instagram')) {
                        const win = this.app.page.getWinNode();
                        win?.instgrm?.Embeds.process();
                    }

                    this.build(scripts.slice(index + 1));
                });

                this.app.page.getDoc().get().head?.appendChild($script.get());
            }
        });
    }
}
/*jshint esversion: 6 */
class ImageManager {
    constructor(app) {
        this.app = app;
        this.dataStates = [];
    }

    popupWrap(e, button) {
        this._popupStyle(e, button, 'wrap');
    }

    popupOutset(e, button) {
        this._popupStyle(e, button, 'outset');
    }

    popup(e, button) {
        const customHandler = this.config.get('image.create');
        if (customHandler) {
            customHandler(this.app);
            return;
        }

        if (this.config.is('image.url') && !this.config.is('image.select') && !this.config.is('image.upload')) {
            this.app.dropdown.create('image', { width: '300px', focus: 'url', form: this._createImageByUrl() });
        } else {
            this.app.dropdown.create('image', { width: '300px' });

            this.createUploadTab('image.insertByUpload');
            this.createUrlTab();
            this.createSelectTab();
        }

        this.app.dropdown.open(e, button);
    }

    createSelectTab(edit) {
        if (!this.config.is('image.select')) return;

        this.$selectbox = this.dom('<div class="rx-dropdown-images">');
        this._createSelectBox(this.$selectbox, edit);

        this.app.dropdown.addTab('select', {
            title: "## image.tab-select ##",
            html: this.$selectbox
        });
    }

    createUrlTab() {
        if (!this.config.is('image.url')) return;

        this.app.dropdown.addTab('url', {
            title: "## image.tab-url ##",
            focus: 'url',
            form: this._createImageByUrl()
        });
    }

    createUploadTab(command) {
        if (!this.config.is('image.upload')) return;

        this.$uploadBox = this.dom('<div>');
        this.$upload = this.dom('<div>');
        this.$uploadBox.append(this.$upload);

        this._buildUpload(this.$upload, command);

        this.app.dropdown.addTab('upload', {
            title: "## image.tab-upload ##",
            html: this.$uploadBox
        });
    }

    createPropsTab() {

        const form = this.app.create('form', {
            getter: 'block.getData',
            items: {
                flex: {
                    width: { type: 'input', width: '100px', label: '## image.width ##', observer: 'image.observeImageWidth' },
                    height: { type: 'input', width: '100px', label: '## image.height ##', observer: 'image.observeImageHeight' }
                },
                src: { type: 'input', label: '## image.src ##' },
                alt: { type: 'input', label: '## image.alt-text ##' },
                caption: { type: 'input', label: '## image.caption ##', observer: 'image.observeImageCaption' },
                url: { type: 'input', label: '## image.link ##', observer: 'image.observeImageLink' },
                flex2: {
                    target: { type: 'checkbox', text: '## image.link-in-new-tab ##', observer: 'image.observeImageLink', auto: true },
                    save: { type: 'button', text: '## buttons.save ##', command: 'image.save', role: 'primary' }
                }
            }
        });

        this.app.dropdown.addTab('props', {
            title: "## image.tab-props ##",
            form: form
        });
    }

    edit(e, button) {
        const customHandler = this.config.get('image.edit');
        if (customHandler) {
            customHandler(this.app, this.app.block.get());
            return;
        }

        this.app.dropdown.create('image', { width: '300px' });

        this.createPropsTab();
        this.createUploadTab('image.changeByUpload');
        this.createSelectTab(true);

        this.app.dropdown.open(e, button);
    }

    wrap(params) {
        this._applyImageClass(params, 'wrap');
    }

    outset(params) {
        this._applyImageClass(params, 'outset');
    }

    observe(obj, name) {
        const instance = this.app.block.get();
        switch (name) {
            case 'image':
                if (instance && instance.isType('image')) {
                    obj.command = 'image.edit';
                }
                break;
            case 'wrap':
            case 'outset':
                if (!this.config.is(name)) {
                    return;
                }
                break;
        }

        return obj;
    }

    observeStates() {
        const $images = this._findImages();
        const images = [];

        $images.each(this._addImageState.bind(this));
        $images.each(($node) => {
            const id = $node.attr('data-image');
            if (id) images[id] = $node;
        });

        Object.entries(this.dataStates).forEach(([key]) => {
            this.dataStates[key].status = !!images[key];
        });
    }

    observeImageLink(obj) {
        return (this.config.is('image.link')) ? obj : false;
    }

    observeImageCaption(obj) {
        const instance = this.app.block.get();
        return instance && instance.isFigure() ? obj : false;
    }

    observeImageWidth(obj) {
        return this.config.is('image.width') ? obj : false;
    }

    observeImageHeight(obj) {
        return this.config.is('image.height') ? obj : false;
    }

    drop(e, dt) {
        const files = Array.from(dt.files).map(file => file || dt.items[i]?.getAsFile()).filter(Boolean);
        if (!files.length) return;

        const $block = this.dom(e.target).closest('[data-rx-type]');
        if ($block.length) this.app.block.set($block);

        this._uploadImage(files, 'image.insertByDrop', e);
    }

    parseInserted(inserted) {
        if (!this.config.is('image.upload')) return;

        let fetchImages = 0;
        const files = [];
        const instances = [];
        this.pasteInsertedImages = [];
        this.resolved = [];

        inserted.each($node => {
            const inst = $node.dataget('instance');
            if (inst) instances.push(inst);
        });

        // Processing each instance
        instances.forEach((instance, i) => {
            if (instance.getType() !== 'image') return;

            const src = instance.getSrc();

            if (/^data:/i.test(src)) {
                files.push(this._dataURLtoFile(src, `image_${Date.now()}`));
                this.pasteInsertedImages.push(instance);
            } else if (/^blob:/i.test(src)) {
                fetchImages++;
                this.pasteInsertedImages.push(instance);

                fetch(src)
                    .then(response => {
                        if (!response.ok) throw new Error(`Failed to fetch blob: ${response.statusText}`);
                        return response.blob();
                    })
                    .then(blob => {
                        const file = new File([blob], `image_${i}`, { type: blob.type || 'image/png' });
                        this.resolved.push(file);
                    })
            }
        });

        // Waiting for blob images to load
        if (fetchImages > 0) {
            const interval = setInterval(() => {
                if (this.resolved.length === fetchImages) {
                    clearInterval(interval);
                    this._uploadImage(this.resolved, 'image.insertFromInserted');
                }
            }, 100);
        }

        // Sending files to the server
        if (files.length > 0) {
            this._uploadImage(files, 'image.insertFromInserted');
        }
    }

    paste(blob, e) {
        if (!this.config.is('image.upload')) return;
        this._uploadImage([blob], 'image.insertFromBlob', e);
    }

    insertFromClipboard(e, clipboard) {
        const text = (clipboard.getData("text/plain") || clipboard.getData("text/html")).trim();
        if (text) return;

        const event = this.app.broadcast('editor.before.paste', { e: e, html: text, type: 'image' });
        if (event.isStopped()) {
            return;
        }

        for (const item of clipboard.items) {
            if (item.type.startsWith("image")) {
                this.paste(item.getAsFile());
                return true;
            }
        }
    }

    insertFromBlob(response) {
        this.insert(response, 'upload');
        const $node = this.insertedImages ? this.insertedImages[0].getBlock() : this.dom([]);
        this.app.broadcast('editor.paste', { $nodes: $node, instances: this.insertedImages });
    }

    insertFromInserted(response) {
        Object.entries(response).forEach(([_, item], index) => {
            this.pasteInsertedImages[index]?.setData(item);
        });
    }

    insertByDrop(response, e) {
        if (this.app.block.is()) {
            const instance = this.app.block.get();
            if (instance.isType('image')) {
                this.update(response, true, true);
                return;
            } else if (e && instance.isEditable()) {
                const insertion = new Insertion(this.app);
                insertion.insertPoint(e);
            }
        }

        this.insert(response, 'upload');
    }

    insertByUrl(form) {
        const url = form.getInput('url').val().trim();
        if (!url) return;
        this.insert({ file: { url, id: new Utils(this.app).getRandomId() } }, 'upload');
    }

    insertByUpload(response) {
        this.app.dropdown.restoreSelection();
        this.insert(response, 'upload');
    }

    insertFromSelect(e) {
        e.preventDefault();
        this.app.dropdown.restoreSelection();
        this.insert({ file: this._createObjectFromSelect(e) }, 'select');
    }

    insert(response, eventType = 'insert') {
        this.app.dropdown.close();
        this._insert(response, eventType);
    }

    changeFromSelect(e) {
        e.preventDefault();

        const obj = this._createObjectFromSelect(e);
        this.update(obj);
    }

    changeByUpload(response) {
        this.update(response, false, true);
    }

    // @deprecated 5.0
    change(data, closePopup) {
        return this.update(data, closePopup);
    }

    update(data, closePopup = true, upload = false) {
        if (closePopup) this.app.dropdown.close();

        const instance = this.app.block.get();
        this.app.broadcast('image.before.change', { instance, data });
        this._extractItems(data, (item) => {
            const processedData = (upload) ? this._processData(item) : item;
            if (!processedData.srcset) {
                processedData.srcset = '';
            }
            instance.setData(processedData);
            this.app.broadcast('image.change', { instance, data: processedData });
            if (upload) {
                this.app.broadcast('image.upload', { instance, data: processedData });
            }
         });

         return instance;
    }

    get() {
        const instance = this.app.block.get();
        return instance && instance.isType('image') ? instance : null;
    }

    save(stack) {
        const data = stack.getData();

        this.app.dropdown.close();
        this.app.block.setData(data);
    }

    remove() {
        this.app.dropdown.close();
        this.app.block.remove();
    }

    error(response) {
        this.app.broadcast('image.upload.error', { response: response });
    }

    getStates() {
        return this.dataStates;
    }

    setImageState(instance, data, status) {
        if (data.uid) {
            this.dataStates[data.uid].status = status;
        }
    }

    // Private methods

    _insert(data, eventType) {
        this.imageslen = 0;
        this.imagescount = 0;
        const insertion = new Insertion(this.app);
        const insertedImages = [];
        const current = this.app.block.get();

        this._extractItems(data, (item) => {
            const instance = this.app.create('block.image', this._processData(item));
            if (instance) {
                insertion.insert({ instance, remove: false });
                instance.getImage().one('load', this._checkImageLoad.bind(this));
                insertedImages.push(instance);

                this.app.broadcast(`image.${eventType}`, { instance, data: item });
                this.$last = instance.getBlock();
                this.imageslen++;
            }
        });

        if (current && current.isEditable() && current.isEmpty()) {
            current.remove();
        }

        this.insertedImages = insertedImages;
    }

    _processData(item) {
        const { src, url, link } = item;

        item.src = src || url;
        item.url = link || null;

        return item;
    }

    _extractItems(data, callback) {
        if (Array.isArray(data)) {
            data.reverse().forEach(item => callback(item));
        } else if (typeof data === 'object' && data !== null) {
            if (data.src || data.url) {
                callback(data);
            } else {
                Object.values(data).reverse().forEach(item => {
                    if (typeof item === 'object' && (item.src || item.url)) {
                        callback(item);
                    }
                });
            }
        }
    }

    _popupStyle(e, button, type) {
        const items = this.config.get(type);
        const instance = this.app.block.get();
        const currentClass = instance ? instance.getClassname(items) : 'none';

        const buttons = Object.entries(items).reduce((acc, [key, value]) => {
            acc[key] = {
                title: this.loc.get(`${type}.${type}-${key}`),
                command: `image.${type}`,
                active: key === currentClass,
                params: { classname: value }
            };
            return acc;
        }, {});

        this.app.dropdown.create(type, { items: buttons });
        this.app.dropdown.open(e, button);
    }

    _applyImageClass(params, type) {
        this.app.dropdown.close();

        const classname = params.classname;
        const items = this.config.get(type);
        const instance = this.app.block.get();

        if (!instance) return;

        if (type === 'wrap') {
            if (['none', 'wrap-center'].includes(classname)) {
                instance.setStyle({ 'max-width': '' });
            }

            if (this.config.is('wrapWithStyle')) {
                if (['none', 'wrap-center'].includes(classname)) {
                    instance.removeClasses(items);
                    this._toggleCentered(instance, classname);
                } else {
                    this._unsetCentered(instance);
                    instance.setClassname(classname, items);
                }
            } else {
                instance.setClassname(classname, items);
            }
        } else {
            instance.setClassname(classname, items);
        }

        this.app.control.updatePosition();
        this.app.broadcast(`image.${type}`, { image: instance });
    }

    _uploadImage(files, successCallback, e = null) {
        if (!files.length || !this.config.is('image.upload')) return;

        const params = {
            url: this.config.get('image.upload'),
            name: this.config.get('image.name'),
            data: this.config.get('image.data'),
            multiple: this.config.get('image.multiple'),
            success: successCallback,
            error: 'image.error'
        };

        new Uploader(this.app, { params }).send(e, files);
    }

    _toggleCentered(instance, name) {
        if (name === 'none') {
            this._unsetCentered(instance);
        } else {
            const isCentered = instance.getBlock().css('text-align') === 'center';
            if (isCentered) this._unsetCentered(instance);
            else this._setCentered(instance);
        }
    }

    _setCentered(instance) {
        instance.setStyle({ 'text-align': 'center' });
        instance.getImage().css({ 'margin-left': 'auto', 'margin-right': 'auto' });
        instance.getCaptionElement().css({ 'text-align': 'center', 'margin-left': 'auto', 'margin-right': 'auto' });
    }

    _unsetCentered(instance) {
        instance.setStyle({ 'text-align': '' });
        instance.getImage().css({ 'margin-left': '', 'margin-right': '' });
        instance.getCaptionElement().css({ 'text-align': '', 'margin-left': '', 'margin-right': '' });
    }

    _buildUpload($item, successCallback) {
        if (!this.config.is('image.upload')) return;

        let params = {
            box: true,
            placeholder: this.loc.get('image.upload-new-placeholder'),
            url: this.config.get('image.upload'),
            name: this.config.get('image.name'),
            data: this.config.get('image.data'),
            multiple: this.config.get('image.multiple'),
            success: successCallback,
            error: 'image.error'
        };

        const upload = new Uploader(this.app, { element: $item, params: params });
    }

    _createObjectFromSelect(e) {
        const $target = this.dom(e.target);
        const obj = $target.data();
        const attrs = ['id', 'alt', 'caption', 'url', 'width', 'height'];

        attrs.forEach(attr => {
            const value = $target.attr(`data-${attr}`);
            if (value !== null) {
                obj[attr] = value;
            }
        });

        return obj;
    }

    _createSelectBox($target, edit) {
        if (!this.config.get('image.select')) return;

        const handler = this.config.get('image.select');

        if (typeof handler === 'object') {
            this._parseList(handler, callback);
        } else {
            const apiMethod = edit ? 'image.changeFromSelect' : 'image.insertFromSelect';
            const getdata = (this.config.is('reloadmarker')) ? { d: new Date().getTime() } : {};
            this.ajax.request(this.config.get('image.selectMethod'), {
                url: handler,
                data: getdata,
                success: function(data) {
                    this._parseList(data, apiMethod);
                }.bind(this)
            });
        }
    }

    _createImageByUrl() {
        return this.app.create('form', {
            command: 'image.insertByUrl',
            items: {
                flex: {
                    url: { type: 'input', placeholder: this.loc.get('image.url-placeholder'), auto: true  },
                    insert: { type: 'button', text: `## buttons.insert ##`, command: 'image.insertByUrl', role: 'primary' }
                }
            }
        });
    }

    _checkImageLoad() {
        this.imagescount++;

        // checks if the image should not be inserted, e.g. in nondeletable
        if (!this.app.page.getDocNode().body.contains(this.$last.get())) {
            return;
        }

        if (this.imagescount === this.imageslen) {
            this.app.block.unset();
            this.app.block.set(this.$last);
            this.app.editor.adjustHeight();
            this.app.observer.observe();
        }
    }

    _parseList(data, callback) {
        Object.entries(data).forEach(([key, item]) => {
            if (typeof item !== 'object') return;

            const url = item.thumb || item.url;
            if (!url) return;

            const $img = this.dom('<img>').attr({ src: url, 'data-src': item.url, 'data-callback': callback });

            ['id', 'alt', 'caption', 'link', 'width', 'height'].forEach(attr => {
                if (item[attr] !== undefined) {
                    $img.attr(`data-${attr}`, item[attr]);
                }
            });

            $img.on('click', e => {
                const callback = this.dom(e.target).attr('data-callback');
                if (callback) this.app.api(callback, e);
            });

            this.$selectbox.append($img);
        });
    }

    _blobToImage(blob) {
        return new Promise(resolve => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.src = url;
        });
    }

    _dataURLtoFile(dataurl, filename) {
        const [meta, content] = dataurl.split(',');
        const mime = meta.match(/:(.*?);/)[1];
        const bstr = atob(content);
        const u8arr = new Uint8Array(bstr.length);

        for (let i = 0; i < bstr.length; i++) {
            u8arr[i] = bstr.charCodeAt(i);
        }

        return new File([u8arr], filename, { type: mime });
    }

    _findImages() {
        return this.app.editor.getLayout().find('[data-image]');
    }

    _addImageState($node) {
        const id = $node.attr('data-image');
        if (!id) return;

        this.dataStates[id] = { type: 'image', status: true, url: $node.attr('src'), $img: $node, id };
    }
}
class LayoutManager {
    constructor(app) {
        this.app = app;
    }

    popup(event, button) {
        const items = this._prepareLayoutItems();
        this.app.dropdown.create('layout', { items });
        this.app.dropdown.open(event, button);
    }

    insert(params) {
        this.app.dropdown.close();

        const instance = this.app.create('block.layout', params);
        const insertion = new Insertion(this.app);
        insertion.insert({ instance });
    }

    // Private methods

    _prepareLayoutItems() {
        const layouts = this.config.get('layouts');
        const items = Redactor.extend(true, {}, layouts);

        Object.entries(items).forEach(([key, item]) => {
            item.command = 'layout.insert';
            item.params = Redactor.extend(true, {}, item);
        });

        return items;
    }
}
class LinkManager {
    constructor(app) {
        this.app = app;

        this.dropdowns = {
            format: this._createDropdown('link.popupCreate', '## link.link ##'),
            change: this._createDropdown('link.popupEdit', '## link.edit-link ##')
        };
    }

    popup(e, button, hotkey) {
        const $link = this.get().eq(0);
        const len = $link.length;
        const selection = new TextRange(this.app);
        const isSelection = this._isImageLink() ? true : selection.is();

        if ((!e && len === 0) || !isSelection || len === 0) {
            button = (!e && this._isImageLink()) ? false : button;

            if (hotkey === true && this.app.toolbar.isEnabled()) {
                e = button;
                button = this.app.toolbar.getButton('link');
            }

            this.popupCreate(false, button, 'link', e);
        }
        else if (len === 1) {
            this.app.dropdown.create('link-dropdown', { items: this.dropdowns.change });
            this.app.dropdown.open(e, button);
        }
    }

    popupCreate(params, button, name, e) {
        const selection = new TextRange(this.app);
        const text = selection.getText();
        const createCallback = this.config.get('link.create');
        if (createCallback) return createCallback(this.app, text);

        this.emptyInline = false;
        const inline = selection.getInline();
        if (inline && inline.innerText === '') {
            this.emptyInline = inline;
        }

        const data = {
            text: (text) ? text : '',
            target: this.config.get('link.target')
        };

        const form = this.app.create('form', {
            data,
            items: {
                url: { type: 'input', placeholder: '## link.url ##' },
                text: { type: 'input', placeholder: '## link.text ##' },
                flex: {
                    target: { type: 'checkbox', text: '## link.link-in-new-tab ##', auto: true },
                    insert: { type: 'button', text: '## buttons.insert ##', command: 'link.insert', role: 'primary' }
                }
            }
        });

        this.app.dropdown.create('link', { width: '280px', focus: 'url', form });
        this.app.dropdown.open(e, button);
    }

    popupEdit(params, button, name, e) {
        const $link = this.get().eq(0);
        const data = this._getLinkData($link);
        const createCallback = this.config.get('link.edit');
        if (createCallback) return createCallback(this.app, $link, data);

        const form = this.app.create('form', {
            data,
            items: {
                url: { type: 'input', placeholder: '## link.url ##' },
                text: { type: 'input', placeholder: '## link.text ##' },
                flex: {
                    target: { type: 'checkbox', text: '## link.link-in-new-tab ##', auto: true },
                    save: { type: 'button', text: '## buttons.save ##', command: 'link.save', role: 'primary' }
                }
            }
        });

        this.app.dropdown.create('link', { width: '280px', focus: 'url', form });
        this.app.dropdown.open(e, button);
    }

    create(data) {
        const instance = this.app.block.get();
        const selection = new TextRange(this.app);
        const { link: $link, type } = this._getOrCreateLink(instance, selection, this.emptyInline);

        data.text = data.text || selection.getText() || data.url;

        this.app.editor.save();
        const result = this._setData(data, $link, type);
        if (!data) {
            this.app.editor.restore();
        } else {
            if (type === 'link') {
                selection.select($link);
            }

            this.observeContext($link);
            this.app.broadcast('link.add', { element: $link, data: result });
        }

        this.app.observer.observe();
        return $link;
    }

    update(data) {
        const $links = this.get();
        const selection = new TextRange(this.app);
        const isCollapsed = selection.isCollapsed();

        this.app.editor.save();

        let $lastLink = null;
        $links.each($link => {
            const type = this._isImageLink() ? 'image' : 'link';
            const result = this._setData(data, $link, type);
            this.app.broadcast('link.change', { element: $link, data: result });
            if (isCollapsed && type === 'link' && data.hasOwnProperty('text')) {
                $lastLink = $link;
            }
        });
        this.app.editor.restore();

        if ($lastLink) {
            selection.select($lastLink);
        }

        return $links;
    }

    save(stack) {
        const data = stack.getData();
        if (!data.url) return;

        this.app.dropdown.close();
        this.app.editor.save();

        const $link = this.get().eq(0);
        const type = this._isImageLink() ? 'image' : 'link';
        const result = this._setData(data, $link, type);

        this.app.editor.restore();
        this.app.observer.observe();
        this.app.broadcast('link.change', { element: $link, data: result });
    }

    insert(stack) {
        const data = stack.getData();
        if (!data.url) return;

        this.app.dropdown.close();
        this.create(data);
    }

    open(e, button) {
        const { href } = button.getParams();
        if (href) this.app.page.getWinNode().open(href, "_blank");
    }

    observeContext($link) {
        if (this.app.context.isOpen()) {
            this.addToContext($link);
            this.app.context.showLine();
            this.app.context.updatePosition();
        }
    }

    observe(obj, name, toolbar) {
        const selection = new TextRange(this.app);

        if (toolbar === 'context' && name === 'link' && selection.is()) {
            const $links = this.get();
            this.addToContext($links);
        }

        return obj;
    }

    addToContext($links) {
        const linkText = $links.eq(0).attr('href');
        if ($links.length === 1 && linkText && linkText !== '#') {
            this.app.context.addLine(`<a href="${linkText}">${this._truncateLinkText(linkText)}</a>`);
        }

        if ($links.length > 0) {
            this.app.context.add('unlink', { position: { before: 'link' } });
        }
    }

    unlink(link) {
        this.app.dropdown.close();
        this.app.context.close();

        const links = link ? this.dom(link) : this._getLinks();

        const selection = new TextRange(this.app);
        if (!selection.is() && this._isImageLink()) {
            this._unlinkImage();
        } else if (links.length) {
            this._unlinkLinks(links);
        }
    }

    get() {
        const instance = this.app.block.get();
        if (this._isImageLink()) {
            return instance.getLinkElement();
        }

        return this._getLinks() || this.dom();
    }

    // Private methods

    _createDropdown(command, title) {
        return {
            link: { title, command, icon: false, shortcut: 'Ctrl+k' },
            unlink: { title: '## link.unlink ##', command: 'link.unlink', icon: false }
        };
    }

    _isImageLink() {
        const instance = this.app.block.get();
        return instance && instance.isType('image') && instance.getLinkElement();
    }

    _unlinkLinks($links) {
        this.app.editor.save();
        $links.each($link => {
            this.app.broadcast('link.remove', { data: { url: $link.attr('href'), text: $link.text(), type: 'link' }});
            $link.unwrap();
        });

        this.app.editor.restore();
        this.app.observer.observe();
    }

    _unlinkImage() {
        const instance = this.app.block.get();
        const $link = instance.getLinkElement();
        instance.setUrl('');
        this.app.broadcast('link.remove', { data: { url: $link.attr('href'), text: '', type: 'image' }});
        this.app.observer.observe();
    }

    _getOrCreateLink(instance, selection, emptyInline = false) {
        if (instance && instance.isType('image')) {
            return { link: instance.getLinkElement(), type: 'image' };
        }

        if (instance && instance.isEditable() && instance.isEmpty() && !selection.getText()) {
            const $link = this.dom('<a>');
            instance.getBlock().append($link);
            return { link: $link, type: 'link' };
        }

        if (!instance) {
            const $link = this.dom('<a>');
            const newBlock = this.app.block.create();
            newBlock.getBlock().append($link);

            const $firstBlock = this.app.blocks.get({ first: true });
            $firstBlock.before(newBlock.getBlock());

            this.app.block.set(newBlock);
            return { link: $link, type: 'link' };
        }

        if (emptyInline) {
            const caret = new Caret(this.app);
            caret.set(emptyInline, 'start');
        }

        const nodes = this.app.inline.set({ tag: 'a' });
        return { link: this.dom(nodes.first()), type: 'link' };
    }

    _setData(data, $link, type = 'link') {
        data = this._cleanUrl(data);
        data = this._encodeUrl(data);

        if (type === 'image') {
            const instance = this.app.block.get();
            instance.setUrl(data.url);
            instance.setTarget(data.target);
        }
        else {
            if (data.url) $link.attr('href', data.url);
            if (data.hasOwnProperty('text')) $link.text(data.text);
            data.target ? $link.attr('target', '_blank') : $link.removeAttr('target');
        }

        return data;
    }

    _getLinkData($link) {
        if ($link.length) {
            return this._encodeUrl({
                text: $link.text(),
                url: $link.attr('href'),
                target: $link.attr('target') || this.config.get('link.target')
            });
        }

        return null;
    }

    _getLinks() {
        const selection = new TextRange(this.app);
        if (!selection.is()) {
            return this.dom();
        }

        const links = selection.getNodes({ tags: ['a'] });
        return links.length ? this.dom(links) : this.dom();
    }

    _truncateLinkText(text) {
        const maxLength = this.config.get('link.truncate');
        const cleanText = text.replace(/^https?:\/\//i, '');

        return cleanText.length > maxLength
            ? cleanText.substring(0, maxLength) + '...'
            : cleanText;
    }

    _cleanUrl(data) {
        if (!data.url) return data;

        const encoder = new CleanerEncoder(this.app);
        data.url = encoder.escapeHtml(data.url);
        data.url = (data.url.search(/^javascript:/i) !== -1) ? '' : data.url;
        return data;
    }

    _encodeUrl(data) {
        data.url = (data.url) ? data.url.replace(/&amp;/g, '&') : '';
        return data;
    }
}
/*jshint esversion: 6 */
class ListManager {
    constructor(app) {
        this.app = app;
        this.dropdowns = {
            list: ['bulletlist', 'numberedlist', 'todo'],
            haslist: ['bulletlist', 'numberedlist', 'todo', 'indent', 'outdent']
        };
    }

    popup(e, button) {
        const items = (this._isList()) ? this.dropdowns.haslist : this.dropdowns.list;
        this.app.dropdown.create('list', { items: items });
        this.app.dropdown.open(e, button);
    }
    indent() {
        const selection = new TextRange(this.app);
        const item = selection.getBlock();
        if (!item) return false;

        const $item = this.dom(item);
        const prev = $item.prevElement().get();

        this.app.dropdown.close();

        if (selection.isFullySelected($item) || selection.isCollapsed()) {
            if (prev && prev.tagName === 'LI') {
                this.app.editor.save(item);

                const $prev = this.dom(prev);
                const $prevChild = $prev.children('ul, ol');

                if ($prevChild.length !== 0) {
                    $prevChild.append($item);
                }
                else {
                    const listTag = $item.closest('ul, ol').tag();
                    const $newList = this.dom('<' + listTag + '>');

                    $newList.append($item);
                    $prev.append($newList);
                }

                this.app.editor.restore();
                this.app.control.updatePosition();
                return true;
            }
        }


        return false;
    }
    outdent() {
        const selection = new TextRange(this.app);
        const item = selection.getBlock();

        if (!item) return false;

        const $item = this.dom(item);
        const $list = $item.parent();
        const $li = $list.closest('li');
        const prev = $item.prevElement().get();
        const next = $item.nextElement().get();

        this.app.dropdown.close();

        if (selection.isAll($item) || selection.isCollapsed()) {
            if ($li.length === 0 && !prev) return this._replaceListWithText();
            if ($li.length === 0) return false;

            const marker = new Marker(this.app);
            marker.save();

            if (prev && next) {
                const nextItems = this._getAllNext($item.get());
                const $newList = this.dom('<' + $list.tag() + '>');

                if (nextItems.length) {
                    nextItems.forEach(el => $newList.append(el));
                }

                $li.after($item);
                $item.append($newList);
            }
            else {
                $li.after($item);

                if ($list.children().length === 0) {
                    $list.remove();
                } else if (!prev) {
                    $item.append($listItem);
                }
            }


            marker.restore();
            this.app.control.updatePosition();
            return true;
        }

        return false;
    }

    // Private methods

    _isList() {
        const instance = this.app.block.get();
        return instance && instance.isType('listitem');
    }

    _getAllNext(next) {
        const nodes = [];
        while (next) {
            next = this.dom(next).nextElement().get();
            if (next) nodes.push(next);
            else break;
        }
        return nodes;
    }

    _replaceListWithText() {
        const instance = this.app.block.get();
        if (!instance.hasParentList()) {
            this.app.dropdown.close();
            this.app.context.close();

            const marker = new Marker(this.app);
            marker.save();

            const list = instance.getParent();
            const $list = list.getBlock();
            const text = this.app.block.create(instance.getContent());

            $list.before(text.getBlock());
            instance.getBlock().remove();

            if ($list.children().length === 0) {
                $list.remove();
            }

            this.app.editor.build();
            this.app.block.set(text);
            marker.restore();

            return false;
        }
    }
}
class TableManager {
    constructor(app) {
        this.app = app;
        this.dropdowns = this._buildDropdowns();
    }

    observe(obj, name, toolbar) {
        if (!this.config.is('table')) return false;

        if (toolbar !== 'dropdown') {
            const instance = this.app.block.get();
            if (instance && instance.getBlock().closest('table').length) {
                obj.command = 'table.popup';
            }
        }

        return obj;
    }

    popup(e, button) {
        const instance = this.app.block.get();
        if (instance) {
            const items = this._filterDropdownItems(instance);

            this.app.dropdown.create('table', { items });
            this.app.dropdown.open(e, button);
        }
    }

    addHead() {
        const { $table, columns } = this._getTableInfo();

        this.removeHead();

        const $head = this.dom('<thead>');
        const $newRow = this._buildRow(false, columns, '<th>');

        $head.append($newRow);
        $table.prepend($head);
        this.app.block.set($newRow.children('td, th').first(), 'start');
    }

    addRowBelow() {
        this._addRow('below');
    }

    addRowAbove() {
        this._addRow('above');
    }

    addColumnBefore() {
        this._addColumn('before');
    }

    addColumnAfter() {
        this._addColumn('after');
    }

    removeHead() {
        this._closeUI();

        const { $table } = this._getTableInfo();
        const $head = $table.find('thead');
        if ($head.length !== 0) {
            $head.remove();
            this.app.block.set($table, 'start');
        }
    }

    removeRow() {
        this._closeUI();

        const cell = this._getCurrentCell();
        if (!cell) return;

        const table = cell.getTable();
        const row = cell.getRow();

        const $block = row.getBlock();
        const $head = $block.closest('thead');
        $head.length ? $head.remove() : row.remove();

        table.getRows().length
        ? this.app.block.set(table.getFirstBlock(), 'start')
        : table.remove({ traverse: true });
    }

    removeColumn() {
        this._closeUI();

        const cell = this._getCurrentCell();
        if (!cell) return;

        const table = cell.getTable();
        const $block = cell.getBlock();
        const $table = $block.closest('table');

        const columnIndex = this._getColumnIndex($block);
        $table.find('tr').each(($row) => {
            $row.find('td, th').eq(columnIndex).remove();
        });

        if (table.getCells().length) {
            const focusIndex = Math.max(0, columnIndex - 1);
            let $target;
            if (focusIndex !== 0) {
                $target = this.dom($table.find('tr').first().find('td, th').get(focusIndex));
                let rowTarget = $target.dataget('instance');
                $target = rowTarget.getFirstElement();
            }
            else {
                $target = table.getFirstBlock();
            }

            this.app.block.set($target, 'start');
        }
        else {
            table.remove({ traverse: true });
        }
    }

    removeTable() {
        this.app.dropdown.close();

        const instance = this.app.block.get();
        const table = instance.getBlock().closest('table').dataget('instance');
        table.remove({ traverse: true });

        if (this.app.editor.isEmpty()) {
            this.app.editor.setEmpty();
        }
    }

    cellSetting(e, button) {
        const instance = this.app.block.get();

        const form = this.app.create('form', {
            data: {
                width: instance.getWidth(),
                nowrap: instance.getNowrap()
            },
            setter: 'table.setCell',
            command: 'table.saveCell',
            items: {
                width: { type: 'input', placeholder: '## table.width ##' },
                nowrap: { type: 'checkbox', text: '## table.nowrap ##' }
            }
        });

        this.app.dropdown.create('cell-setting', { form, focus: 'width' });
        this.app.dropdown.open(e, button);
    }

    setCell(stack) {
        this._saveCell(stack);
    }

    saveCell(stack) {
        this.app.dropdown.close();
        this._saveCell(stack);
    }

    _saveCell(stack) {
        const instance = this.app.block.get();
        const data = stack.getData();
        if (data.width !== '') {
            instance.setWidth(data.width);
        }

        instance.setNowrap(data.nowrap);
        this.app.control.updatePosition();
    }

    // Private methods

    _buildDropdowns() {
        return {
            items: {
                addhead: { title: '## table.add-head ##', command: 'table.addHead' },
                addcolumnbefore: { title: '## table.add-column-before ##', command: 'table.addColumnBefore' },
                addcolumnafter: { title: '## table.add-column-after ##', command: 'table.addColumnAfter' },
                addrowbelow: { title: '## table.add-row-below ##', command: 'table.addRowBelow' },
                addrowabove: { title: '## table.add-row-above ##', command: 'table.addRowAbove' },
                removehead: { title: '## table.remove-head ##', command: 'table.removeHead', divider: 'top' },
                removecolumn: { title: '## table.remove-column ##', command: 'table.removeColumn' },
                removerow: { title: '## table.remove-row ##', command: 'table.removeRow' },
                removetable: { title: '## table.delete-table ##', command: 'table.removeTable', divider: 'top', danger: true }
            }
        };
    }

    _filterDropdownItems(instance) {
        const items = { ...this.dropdowns.items };
        if (instance.isNondeletable() || instance.isNondeletableParent()) {
            delete items.removetable;
        }

        const disabled = instance.isType('table');
        Object.keys(items).forEach(key => {
            if (key !== 'removetable') items[key].disabled = disabled;
        });

        return items;
    }

    _closeUI() {
        this.app.dropdown.close();
        this.app.control.close();
    }

    _getColumnIndex($block) {
        const $row = $block.closest('tr');
        let index = 0;

        $row.find('td, th').each(($node, i) => {
            if ($node.get() === $block.get()) {
                index = i;
            }
        });

        return index;
    }

    _getCurrentCell() {
        const instance = this.app.block.get();
        return instance.isType('cell') ? instance : instance.getClosest('cell');
    }

    _getTableInfo() {
        const instance = this.app.block.get();
        const cell = instance.isType('cell') ? instance : instance.getClosest('cell');
        const table = cell.getTable();
        const $table = table.getBlock();
        const columns =  $table.find('tr').first().children('td, th').length;

        return { $table, columns };
    }

    _addColumn(position) {
        this._closeUI();

        const cell = this._getCurrentCell();
        if (!cell) return;

        const $table = cell.getBlock().closest('table');
        const columnIndex = cell.getBlock().get().cellIndex;
        const rowIndex = cell.getBlock().closest('tr').get().rowIndex;

        let $newCell = null;
        $table.find('tr').each(($node, i) => {
            const $cell = this.dom($node.find('td, th').get(columnIndex));
            if (!$cell.length) return;

            const $newCellInstance = this._createNewCell($cell);
            $cell[position]($newCellInstance);

            if (i === rowIndex) {
                $newCell = $newCellInstance;
            }

        });

        if ($newCell) {
            const newCell = $newCell.dataget('instance');
            this.app.block.set(newCell.getFirstElement(), 'start');
        }
    }

    _createNewCell($cell) {
        const $newCell = $cell.clone().removeClass('rx-block-focus').empty();
        this.app.create('block.cell', $newCell);

        const textBlock = this.app.block.create();
        $newCell.append(textBlock.getBlock());

        return $newCell;
    }

    _addRow(name) {
        this._closeUI();

        const position = (name === 'below') ? 'after' : 'before';
        const instance = this.app.block.get();

        const $block = instance.getClosest('row').getBlock();
        const $row = $block.closest('tr');
        const $head = $block.closest('thead');
        const columns = $row.children('td, th').length;
        const $newRow = this._buildRow($row, columns, '<td>');

        $head.length ? $head.after($newRow) : $row[position]($newRow);

        const newRow = $newRow.dataget('instance');
        this.app.block.set(newRow.getFirstElement(), 'start');
    }

    _buildRow($row, columns, tag) {
        const $newRow = $row ? this._cloneRow($row) : this._createEmptyRow(columns, tag);
        this.app.create('block.row', $newRow);

        $newRow.find('td, th').each($node => {
            const cell = this.app.create('block.cell', $node);
            const textBlock = this.app.block.create();
            cell.getBlock().append(textBlock.getBlock());
        });

        return $newRow;
    }

    _createEmptyRow(columns, tag) {
        const $row = this.dom('<tr>');

        for (let i = 0; i < columns; i++) {
            const $cell = this.dom(tag);
            this.app.create('block.cell', $cell);
            $row.append($cell);
        }

        return $row;
    }

    _cloneRow($row) {
        const $clonedRow = $row.clone();
        $clonedRow.find('td, th').removeClass('rx-block-focus').empty();
        return $clonedRow;
    }
}
/*jshint esversion: 6 */
Redactor.add('block', 'address', {
    mixins: ['block'],
    props: {
        type: 'address',
        editable: true,
        inline: false,
        control: {
            'format': {
                position: { after: 'add', first: true }
            }
        }
    },
    defaults: {
        content: { getter: 'getContent', setter: 'setContent' }
    },
    create() {
        return this.dom('<address>');
    },
    handleDelete(e, key, event) {
        if (event.is('backspace') && this.isCaretEnd() && this._removeEmptyBrTags()) {
            e.preventDefault();
            return true;
        }
    },
    handleEnter(e) {
        e.preventDefault();
        if (this.isEmpty() || this.isCaretEnd()) {
            if (this._removeEmptyBrTags()) {
                this._insertAfterEmptyBlock();
                return;
            }
        }

        return this._insertBreakline();
    },

    // Remove empty <br> at the end
    _removeEmptyBrTags() {
        const utils = new Utils(this.app);
        const $nodes = this.$block.children();
        const len = $nodes.length;
        const $last = $nodes.eq(len - 1);
        let html = this.$block.html().trim();
        html = utils.removeInvisibleChars(html);

        if (html.endsWith('<br>') || html.endsWith('<br/>')) {
            $last.remove();
            return true;
        }

        return false;
    },

    // Inserting an empty block after the current block
    _insertAfterEmptyBlock() {
        this.insertEmpty({ position: 'after', caret: 'start', type: 'input' });
    },

    // Inserting a line break
    _insertBreakline() {
        const insertion = new Insertion(this.app);
        insertion.insertBreakline();
        return true;
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'dlist', {
    mixins: ['block'],
    props: {
        type: 'dlist',
        editable: true,
        inline: false,
        control: {
            'format': {
                position: { after: 'add', first: true }
            }
        }
    },
    defaults: {
        items: { getter: 'getItems' }
    },
    create() {
        return this.dom('<dl>')
            .append(this.dom('<dt>').html('Term'))
            .append(this.dom('<dd>').html('Description'));
    },
    build() {
        this._buildItems();
    },
    setCaret(point) {
        const caret = new Caret(this.app);
        const $el = (point === 'start') ? this.getFirstItem() : this.getLastItem();
        caret.set($el, point);
    },
    getLastItem() {
        return this.$block.children().last();
    },
    getFirstItem() {
        return this.$block.children().first();
    },
    getItems() {
        const items = [];

        this.$block.find('dt').each(($node) => {
            const termHtml = this.unparseInlineBlocks($node.clone()).html();
            const $next = $node.nextElement();
            const descHtml = $next && $next.tag('dd')
                             ? this.unparseInlineBlocks($next.clone()).html()
                             : '';

            items.push({ term: termHtml, desc: descHtml });
        });

        return items;
    },
    handleEnter(e) {
        e.preventDefault();

        const insertion = new Insertion(this.app);
        const selection = new TextRange(this.app);
        const utils = new Utils(this.app);
        const caret = new Caret(this.app);
        const $currentItem = this.dom(selection.getBlock());
        const tag = $currentItem.tag();

        // Handling caret at the end of current item
        if (caret.is($currentItem, 'end') && !this.isCaretEnd()) {
            this._insertCorrespondingTag($currentItem, tag, caret);
        }
        // Handling empty or caret at the end of dlist scenarios
        else if (this.isEmpty() || this.isCaretEnd()) {
            const isItemEmpty = utils.isEmptyHtml($currentItem.html());

            // If the current item is empty and is a <dt>, remove it and insert a new input
            if (tag === 'dt' && isItemEmpty) {
                $currentItem.remove();
                this.insertEmpty({ position: 'after', caret: 'start', type: 'input' });
                return true;
            }

            this._insertCorrespondingTag($currentItem, tag, caret);
            return true;
        }
        // Handling caret at the start scenarios
        else if (this.isCaretStart()) {
            return true;
        }
        // Handling caret in the middle scenarios
        else {
            insertion.insertBreakline();
            return true;
        }
    },

    // private
    _insertCorrespondingTag($currentItem, tag, caret) {
        const $newItem = this.dom(tag === 'dt' ? '<dd>' : '<dt>');
        $currentItem.after($newItem);
        caret.set($newItem, 'start');
    },
    _buildItems() {
        const items = this.data.get('items');
        if (items) {
            this.$block.html('');
            items.forEach(item => {
                this.$block.append(this.dom('<dt>').html(item.term));
                this.$block.append(this.dom('<dd>').html(item.desc));
            });
        }
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'embed', {
    mixins: ['block'],
    parser: false,
    props: {
        type: 'embed',
        focusable: true,
        editable: false,
        inline: false,
        control: {
            'embed': { position: { after: 'add' } }
        }
    },
    defaults: {
        content: { getter: 'getContent', setter: 'setContent' },
        caption: { getter: 'getCaption', setter: 'setCaption' },
        responsive: { getter: 'getResponsive', setter: 'setResponsive' }
    },
    start() {
        this.embedClassname = this.opts.get('embed.classname');
        this.responsiveClassname = this.opts.get('embed.responsiveClassname');
    },
    create() {
        return this.dom('<figure>');
    },
    parse() {
        this.$embed = (this.embedClassname) ? this.$block.find('.' + this.embedClassname) : this.$block;
        if (this.$block.hasClass('rx-figure-iframe')) {
            this.$block.data('figure-frame', true);
        }

        let content = (this.$embed.length === 0) ? this._initializeEmbed() : this.$embed.html();

        this.parseCaption();
        this.setContent(content);
        this._handleResponsive();
    },
    build() {
        this.$embed = this._createEmbed();
        this._handleResponsive();
    },
    getContent() {
        return decodeURI(this.$block.attr('data-embed-content')).trim();
    },
    getCaption() {
        return this.figcaption ? this.figcaption.getContent() : null;
    },
    getResponsive() {
        return this.$embed.hasClass(this.responsiveClassname) || null;
    },
    getVideoTitle() {
        return this.$embed.find('video').attr('title');
    },
    getVideoPoster() {
        return this.$embed.find('video').attr('poster');
    },
    isResponsive() {
        return this.getResponsive();
    },
    setContent(content) {
        content = content.trim();
        this.$embed.html(content);
        this.$block.attr('data-embed-content', encodeURI(content));
    },
    setCaption(caption) {
        if (this.figcaption) {
            this.figcaption.setContent(caption);
        } else {
            this._buildCaption(caption);
        }
    },
    setResponsive(responsive) {
        if (responsive) {
            this.$embed.addClass(this.responsiveClassname);
        }
    },

    // private
    _initializeEmbed() {
        let $figcaption = this.$block.find('figcaption');
        let $clone = this.$block.clone();
        $clone.find('figcaption').remove();
        let content = $clone.html();

        this.$embed = this._createEmbed();

        // revert caption
        if ($figcaption.length !== 0) {
            this.$block.append($figcaption);
        }

        return content;
    },
    _handleResponsive() {
        if (this.opts.is('embed.responsive')) {
            this.$embed.addClass(this.responsiveClassname);
        }
    },
    _createEmbed() {
        if (!this.embedClassname) {
            return this.$block;
        }

        let $embed = this.dom('<div>').addClass(this.embedClassname);
        this.$block.html('');
        this.$block.append($embed);
        return $embed;
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'figcaption', {
    mixins: ['block'],
    props: {
        type: 'figcaption',
        editable: true,
        inline: false,
        control: false
    },
    defaults: {
        content: {getter: 'getContent', setter: 'setContent'}
    },
    create() {
        return this.dom(this.opts.get('figcaption.template'));
    },
    parse() {
        this._buildPlaceholder();
    },
    build() {
        this._buildPlaceholder();
    },
    getFigure() {
        return this.$block.closest('figure').dataget('instance');
    },
    handleDelete(e, key, event) {
        if (event.is('delete') && this.isCaretEnd()) {
            e.preventDefault();
            return true;
        }
    },
    handleArrow(e, key, event) {
        if ((event.is('up+left') && this.isCaretStart()) || (event.is('down+right') && this.isCaretEnd())) {
            e.preventDefault();
            this.app.block.set(this.getFigure());
            return true;
        }
    },
    handleTab(e) {
        e.preventDefault();
        this.app.block.set(this.getFigure());
        return true;
    },
    handleEnter(e) {
        e.preventDefault();

        if (this.isEmpty() || this.isCaretEnd() || this.isCaretStart()) {
            return true;
        } else {
            const insertion = new Insertion(this.app);
            insertion.insertBreakline();
            return true;
        }
    },

    // =private
    _buildPlaceholder() {
        if (!this.$block.attr('data-placeholder')) {
            this.setPlaceholder(this.lang.get('placeholders.figcaption'));
        }
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'heading', {
    mixins: ['block'],
    props: {
        type: 'heading',
        editable: true,
        inline: false,
        control: {
            'format': { position: { after: 'add', first: true } }
        }
    },
    defaults: {
        content: { getter: 'getContent', setter: 'setContent' },
        level: { getter: 'getLevel', setter: 'setLevel' }
    },
    create() {
        return this.dom('<h' + (this.data.get('level') || 2) + '>');
    },
    setLevel(value) {
        const currentLevel = this.getLevel();
        if (currentLevel !== Number(value)) {
            this.$block = this.$block.replaceTag(`h${value}`);
        }
    },
    getLevel() {
        return Number(this.getTag().replace('h', ''));
    },
    handleEnter(e) {
        e.preventDefault();
        if (this.isEmpty() || this.isCaretEnd()) {
            this.insertEmpty({ position: 'after', caret: 'start', remove: false, type: 'input' });
        } else if (this.isCaretStart()) {
            this.insert({ instance: this.duplicateEmpty(), position: 'before', type: 'input' });
        } else {
            const splitter = new ElementSplitter(this.app);
            const $part = splitter.split(this.$block);
            this.app.block.set($part, 'start');
            this.app.emit('block.split', { element: $part.get() });
        }
        return true;
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'image', {
    mixins: ['block'],
    props: {
        type: 'image',
        focusable: true,
        editable: false,
        inline: false,
        control: {
            'image': { position: { after: 'add' } },
            'wrap': { position: { after: 'image' } },
            'outset': { position: { after: 'image' } }
        }
    },
    defaults: {
        src: { getter: 'getSrc', setter: 'setSrc' },
        srcset: { getter: 'getSrcset', setter: 'setSrcset' },
        url: { getter: 'getUrl', setter: 'setUrl' },
        alt: { getter: 'getAlt', setter: 'setAlt' },
        width: { getter: 'getWidth', setter: 'setWidth' },
        height: { getter: 'getHeight', setter: 'setHeight' },
        img: { getter: 'getImageStyle' },
        target: { getter: 'getTarget', setter: 'setTarget'},
        caption: { getter: 'getCaption', setter: 'setCaption' },
        wrap: { getter: 'getWrap' },
    },
    create() {
        return this.dom('<' + this.opts.get('image.tag') + '>');
    },
    parse() {
        this._parseImage();
        this._parseLink();
        this.parseCaption();
    },
    build() {
        this._buildImageTag();
        this._buildImage();
        this._buildLink();
    },
    getLinkElement() {
        return this.$link;
    },
    getSrc() {
        return this.$image.attr('src');
    },
    getId() {
        return this.$image.attr('id');
    },
    getAlt() {
        return this.$image.attr('alt');
    },
    getSrcset() {
        return this.$image.attr('srcset');
    },
    getUrl() {
        return this.$link ? this.$link.attr('href') : null;
    },
    getTarget() {
        return this.$link && this.$link.attr('target') === '_blank';
    },
    getWrap() {
        let tag = this.$block.tag();
        return (tag === this.opts.get('image.tag')) ? null : tag;
    },
    getCaption() {
        return this.figcaption ? this.figcaption.getContent() : null;
    },
    getCaptionElement() {
        return this.figcaption ? this.figcaption.getBlock() : null;
    },
    getWidth() {
        return this._getStyle('width');
    },
    getHeight() {
        let height = this._getStyle('height');
        return height === null ? this.$image.height() : height;
    },
    getImageStyle() {
        return this._getStyle();
    },
    getDataImage() {
        return this.$image.attr('data-image');
    },
    getImage() {
        return this.$image;
    },
    setAlt(value) {
        this.$image.attr('alt', value.replace(/"/g, "'"));
    },
    setId(id) {
        this.$image.attr('id', id);
        this.$image.attr('data-image', id);
    },
    setSrc(value) {
        this.$image.attr('src', value);
    },
    setSrcset(value) {
        this.$image.attr('srcset', value);
    },
    setHeight(value) {
        value = (value) ? value.trim() : '';

        if (value !== '') {

            let width = this.$image.width();
            width = width === 0 ? parseInt(this.$image.attr('width')) : width;

            let height = this.$image.height();
            height = height === 0 ? parseInt(this.$image.attr('height')) : height;

            const ratio = width / height;
            const newHeight = parseInt(value);
            const newWidth = Math.trunc(newHeight * ratio);

            this._setWidth(newWidth + 'px');
            this._setHeight(newHeight);
        } else {
            this._resetImageHeight();
        }

        // clean style attr
        const cache = new CleanerCache(this.app);
        cache.cacheElementStyle(this.$image);

        // broadcast
        this.app.broadcast('image.position');
        this.app.control.updatePosition();
    },
    setWidth(value, height) {
        value = (value) ? value.trim() : '';

        if (value !== '') {
            const isPercent = value.includes('%');
            let width = (isPercent) ? value : parseInt(value);
            let ratio = (this.$image.width() === 0) ? false : this.$image.width() / this.$image.height();

            // height
            height = this._determineHeight(height, width, ratio);

            if (isPercent) {
                this.$image.removeAttr('height');
                this.$image.css('height', '');
                this._setWidth(width);
            } else {
                this._setWidth(width + 'px');
                this._setHeight(height);
            }
        }
        else {
            this._resetImageDimensions();
        }

        // clean style attr
        const cache = new CleanerCache(this.app);
        cache.cacheElementStyle(this.$image);

        // broadcast
        this.app.broadcast('image.position');
        this.app.control.updatePosition();
    },
    setCaption(caption) {
        if (this.figcaption) {
            this.figcaption.setContent(caption);
        } else {
            this._buildCaption(caption);
        }
    },
    setUrl(value) {
        if (this.$link) {
            if (value === '' || value === null) {
                this.$link.unwrap();
                this.$link = false;
            } else {
                this.$link.attr('href', value);
            }
        } else if (value !== '' && value !== null) {
            this._createLink(value);
        }
    },
    setTarget(value) {
        if (!this.$link) return;
        if (value && value !== '') {
            this.$link.attr('target', '_blank');
        } else {
            this.$link.removeAttr('target');
        }
    },

    // =private
    _determineHeight(height, width, ratio) {
        if (this.data.is('height')) {
            height = (ratio === false) ? parseInt(this.data.get('height')) : Math.round(width / ratio);
        }
        else {
            height = (ratio === false) ? false : (height || Math.round(width / ratio));
        }

        return height;
    },
    _setWidth(value) {
        this.$image.css({ 'width': value }).attr({ 'width': value.replace('px', '') });
    },
    _setHeight(value) {
        if (value === false) return;
        this.$image.css({ 'height': value + 'px' }).attr({ 'height': value });

    },
    _resetImageHeight() {
        this.$image.removeAttr('height');
        this.$image.css({ 'height': '' });
        if (this.$image.attr('style') === '') {
            this.$image.removeAttr('style');
        }
    },
    _resetImageDimensions() {
        this.$image.removeAttr('width height');
        this.$image.css({ 'width': '', 'height': '' });
        if (this.$image.attr('style') === '') {
            this.$image.removeAttr('style');
        }
    },
    _createLink(value) {
        this.$link = this.dom('<a>');
        this.$image.wrap(this.$link);
        this.$link.attr('href', value);
    },
    _getStyle(type) {
        const utils = new Utils(this.app);
        let css = utils.cssToObject(this.$image.attr('style'));

        if (type) {
            return this._getStyleValue(css, type);
        } else {
            return this._getAllStyles(css);
        }
    },
    _getStyleValue(css, type) {
        let value = (css[type]) ? css[type].replace('px', '') : this.$image.attr(type);
        return (value) ? value : null;
    },
    _getAllStyles(css) {
        return Object.keys(css).length > 0 ? { style: css } : null;
    },
    _parseImage() {
        let obj = this.data.get('img');

        this.$image = this.$block.find('img');

        // params
        if (obj) {
            this._buildImageParams(obj);
        }
    },
    _parseLink() {
        let $link = this.$block.find('a');
        if ($link.closest('figcaption').length !== 0) return;

        if ($link.length !== 0) {
            this.$link = $link;
        }
    },
    _buildImageTag() {
        let tag = this.getTag();
        let imageTag = this.opts.get('image.tag');
        let dataTag = this.data.get('wrap');

        if (tag !== imageTag || (dataTag && tag !== dataTag)) {
            let newTag = (dataTag) ? dataTag : imageTag;
            this.$block = this.$block.replaceTag(newTag);
        }
    },
    _buildImage() {
        const imageData = this.data.getValues();
        this.$image = this.dom('<img>');
        this.$block.append(this.$image);
        this._buildImageParams(imageData);
    },
    _buildImageParams(imageData) {
        const attributes = ['src', 'alt', 'srcset'];
        attributes.forEach(attr => {
            if (imageData.hasOwnProperty(attr)) {
                this.$image.attr(attr, imageData[attr]);
            }
        });

        if (imageData.img && imageData.img.style) {
            this.$image.css(imageData.img.style);
        }
    },
    _buildLink() {
        const linkData = this.data.getValues();
        if (linkData.url) {
            this.$link = this.dom('<a>').attr('href', linkData.url);
            this.$image.wrap(this.$link);
            if (linkData.target) {
                this.$link.attr('target', '_blank');
            }
        }
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'wrapper', {
    mixins: ['block'],
    nested: true,
    props: {
        type: 'wrapper',
        focusable: true,
        inline: false,
        control: {
            'unwrap': { position: { after: 'add' } }
        }
    },
    defaults: {
        wrap: { getter: 'getWrap', setter: 'setWrap' },
        children: { getter: 'getChildren' }
    },
    create() {
        let $wrapper = this.dom(this.opts.get('wrapper.template'));
        if (this.app.has('email')) {
            $wrapper.addClass('email-wrapper');
        }
        return $wrapper;
    },
    build() {
        if (!this.params.children) {
            this.fillEmpty();
        }
    },
    parse() {
        if (this.app.has('email')) {
            this.$block.addClass('email-wrapper');
        }
    },
    setCaret(point) {
        const $el = this.getFirstBlock();
        if ($el.length !== 0 && $el.dataget('instance')) {
            this.app.block.set($el, point);
        } else {
            this._focusAndCollapseSelection();
        }
    },
    setWrap(tag) {
        this.$block = this.$block.replaceTag(tag);
    },
    getWrap() {
        let tag = this.$block.tag();
        return (tag === 'div') ? null : tag;
    },
    getFirstBlock() {
        return this.$block.children().first();
    },
    fillEmpty() {
        if (this.isEmpty()) {
            this.$block.append(this.app.block.create().getBlock());
        }
    },

    // =private
    _focusAndCollapseSelection() {
        const selection = new TextRange(this.app);
        this.app.scroll.save();
        this.$block.attr('tabindex', '-1').focus();
        selection.collapse();
        setTimeout(() => selection.remove(), 1);
        this.app.scroll.restore();
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'layout', {
    mixins: ['block'],
    nested: true,
    props: {
        type: 'layout',
        focusable: true,
        inline: false,
        control: {
            'unwrap': { position: { after: 'add' } }
        }
    },
    defaults: {
        children: { getter: 'getChildren' }
    },
    create() {
        const grid = this.opts.get('layout.grid');
        const $div = this.dom('<div>');
        if (grid) {
            return $div.addClass(grid);
        }
        else {
            return $div.attr(this.opts.get('dataBlock'), 'layout').addClass('rx-layout-grid');
        }
    },
    parse() {
        const grid = this.opts.get('layout.grid');
        const column = this.opts.get('layout.column');

        if (grid) {
            this._handleGridSetup(column);
        } else {
            this.$block.addClass('rx-layout-grid');
        }
    },
    build() {
        if (!this.params.children) {
            if (this.params.pattern) {
                this._buildFromPattern();
            }
            else {
                this._createAndAppendColumn('50%');
                this._createAndAppendColumn('50%');
            }
        }
    },
    setCaret(point) {
        let targetBlock = (point === 'start') ? this.getFirstBlock() : this.getLastBlock();
        this.app.block.set(targetBlock, point);
    },
    getFirstBlock() {
        return this.getFirstColumn().children().first();
    },
    getLastBlock() {
        return this.getLastColumn().children().last();
    },
    getFirstColumn() {
        return this.$block.find('[data-rx-type=column]').first();
    },
    getLastColumn() {
        return this.$block.find('[data-rx-type=column]').last();
    },
    getColumns() {
        return this.$block.find('[data-rx-type=column]').map((node) => this.dom(node).dataget('instance'));
    },

    // =private
    _handleGridSetup(column) {
        if (!column) {
            this.$block.children().each(($node) => {
                this.app.create('block.column', $node);
            });

            const classApplier = new ClassApplier(this.app);
            classApplier.parse(this.$block);
        }
    },
    _buildFromPattern() {
        const pattern = this.params.pattern.split('|');
        if (this.params.grid) {
            this.$block.addClass(this.params.grid);
        }
        pattern.forEach(part => {
            const obj = this._parsePatternPart(part);
            const column = this.app.create('block.column', obj);
            this.$block.append(column.getBlock());
        });
    },
    _parsePatternPart(part) {
        if (part.includes('%')) {
            return { width: part };
        } else if (part !== '-') {
            return { classname: part };
        }
        return {};
    },
    _createAndAppendColumn(width) {
        const column = this.app.create('block.column', { width: width });
        this.$block.append(column.getBlock());
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'column', {
    mixins: ['block'],
    nested: true,
    props: {
        type: 'column',
        focusable: true,
        inline: false
    },
    defaults: {
        children: { getter: 'getChildren' },
        width: { getter: 'getWidth', setter: 'setWidth' }
    },
    create() {
        const grid = this.opts.get('layout.grid');
        const column = this.opts.get('layout.column');
        const div = this.dom('<div>');

        if (grid && !column) {
            return div;
        }
        else if (column) {
            return div.addClass(column);
        }

        return div.attr(this.opts.get('dataBlock'), 'column');
    },
    build() {
        if (!this.params.children && this.isEmpty()) {
            let block = this.app.block.create();
            this.$block.append(block.getBlock());
        }
    },
    getFirstBlock() {
        return this.$block.children().first();
    },
    getLastBlock() {
        return this.$block.children().last();
    },
    getFirstBlockInstance() {
        return this.getFirstBlock().dataget('instance');
    },
    getLastBlockInstance() {
        return this.getLastBlock().dataget('instance');
    },
    getNextColumn() {
        const $next = this.$block.nextElement();
        if ($next.length > 0 && $next.data('block') === 'column') {
            return $next;
        }

        return false;
    },
    isLastElement() {
        return (this.$block.nextElement().length === 0);
    },
    setWidth(width) {
        if (!this.opts.get('layout.grid')) {
            this.$block.css('flex-basis', width);
        }
    },
    getWidth() {
        return this.opts.get('layout.grid') ? null : this.$block.css('flex-basis');
    },
    handleTab(e) {
        e.preventDefault();
        const next = this.getNextColumn() || this.getClosest('layout').getNext();
        if (next) {
            this.app.block.set(next, 'start');
        }

        return true;
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'line', {
    mixins: ['block'],
    props: {
        type: 'line',
        focusable: true,
        editable: false,
        inline: false
    },
    create() {
        return this.dom(this.opts.get('line.template'));
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'list', {
    mixins: ['block'],
    props: {
        type: 'list',
        focusable: true,
        inline: false,
        control: {
            'format': {
                position: { after: 'add', first: true }
            }
        }
    },
    defaults: {
        numbered: { getter: 'getNumbered' },
        items: { getter: 'getItems' }
    },
    create() {
        return this.dom(`<${this._createTag()}>`).append(this.dom('<li>'));
    },
    parse() {
        this.parseItems('ul, ol', 'list');
        this.parseItems('li', 'listitem');
    },
    build() {
        this._buildItems();
        this.parseItems('ul, ol', 'list');
        this.parseItems('li', 'listitem');
    },
    setCaret(point) {
        let $el = (point === 'start') ? this.getFirstItem() : this.getLastItem();
        this.app.block.set($el, point);
    },
    getFirstItem() {
        return this.$block.find('li').first();
    },
    getFirstItemInstance() {
        return this.getFirstItem().dataget('instance');
    },
    getLastItem() {
        return this.$block.find('li').last();
    },
    getLastItemInstance() {
        return this.getLastItem().dataget('instance');
    },
    getNumbered() {
        return this.getTag() === 'ol';
    },
    getItems() {
        return this.$block.children().all().map(node => this.dom(node).dataget('instance').getContent());
    },

    // private
    _createTag() {
        return this.data.get('numbered') ? 'ol' : 'ul';
    },
    _buildItems() {
        const items = this.data.get('items');
        if (items) {
            this.$block.empty();
            items.forEach(item => this.$block.append(this.dom('<li>').html(item)));
        }
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'listitem', {
    mixins: ['block'],
    props: {
        type: 'listitem',
        editable: true,
        inline: false,
        control: {
            'format': {
                position: { after: 'add', first: true }
            }
        }
    },
    defaults: {
        content: { getter: 'getContent', setter: 'setContent' }
    },
    create() {
        return this.dom('<li>');
    },
    isListEnd() {
        return this.getParent().isCaretEnd();
    },
    isListTopEnd() {
        return this.getParentTopInstance().isCaretEnd();
    },
    isFirstElement() {
        return (this.$block.prevElement().length === 0);
    },
    isLastElement() {
        return (this.$block.nextElement().length === 0);
    },
    hasParentList() {
        return (this.$block.parent().closest('li').length !== 0);
    },
    hasChild() {
        return (this.$block.find('ul, ol').length !== 0);
    },
    getChild() {
        return this.$block.find('ul, ol').first();
    },
    getParentTop() {
        return this.$block.parents('ul, ol').last();
    },
    getParentTopInstance() {
        return this.getParentTop().dataget('instance');
    },
    getParentItem() {
        return this.$block.parent().closest('li').dataget('instance');
    },
    getParent() {
        return this.$block.parent().closest(this._buildTraverseSelector('list')).dataget('instance');
    },
    getContent(ignoreLists = false) {
        let $clone = this.$block.clone();

        if (ignoreLists) {
            $clone.find('ul, ol').remove();
        } else {
            $clone.find('ul, ol').before('<br>').unwrap();
        }

        $clone = this.unparseInlineBlocks($clone);

        let htmlContent = $clone.html();
        let textContent = htmlContent.replace(/<\/?li[^>]*>/g, '\n');
        let trimmedContent = textContent.replace(/\s\s+/g, ' ').replace(/\t/g, '').trim();

        return trimmedContent;
    },

    // handle
    handleArrow(e, key, event) {
        if (event.is('up+left')) {
            return this._traverse('prev', e, event);
        }
        else if (event.is('down+right')) {
            return this._traverse('next', e, event);
        }
    },
    handleDelete(e, key, event) {
        if (event.is('backspace') && this.isCaretStart() && this.isFirstElement() && !this.hasParentList()) {
            e.preventDefault();
            this._handleBackspaceDelete();
            return true;
        } else if (event.is('delete') && this.isListEnd() && this.isLastElement() && !this.hasParentList()) {
            e.preventDefault();
            this._handleForwardDelete();
            return true;
        }

        setTimeout(() => {
            const selection = new TextRange(this.app);
            this.$block = this.dom(selection.getBlock());
            this.$block.find('span').not('[data-rx-style-cache]').unwrap();
            this.$block.get().normalize();
        }, 0);

    },
    handleTab(e) {
        if (this.opts.is('tab.spaces') && !this.isCaretStart()) {
            return;
        }

        e.preventDefault();
        this.app.list.indent();
        return true;
    },
    handleEnter(e) {
        e.preventDefault();

        const caret = new Caret(this.app);
        const isCurrentEnd = caret.is(this.$block, 'end', ['ul', 'ol']);


        if (this.hasChild() && isCurrentEnd) {
            this._handleEnterWithChildAtEnd();
        } else if (!this.hasChild() && this.hasParentList() && this.isListTopEnd()) {
            this._handleEnterAtNestedEnd();
        } else if (this.isEmpty() || this.isCaretEnd()) {
            this._handleEnterAtEmptyOrEnd();
        } else if (this.isCaretStart()) {
            this._handleEnterAtStart();
        } else {
            this._handleEnterInMiddle();
        }

        this.app.observer.observe();

        return true;
    },

    // =private
    _handleEnterWithChildAtEnd() {
        const utils = new Utils(this.app);
        let $part = this.getChild();
        let instance = this._createItem();
        let $cloned = $part.clone();

        $part.remove();
        this.app.block.set(instance, 'start');
        instance.getBlock().append(utils.createInvisibleChar());
        instance.getBlock().append($cloned);
    },
    _handleEnterAtNestedEnd() {
        const selection = new TextRange(this.app);
        const item = selection.getBlockControlled();
        const prevInstance = (item) ? this.dom(item).dataget('instance') : false;

        if (prevInstance && prevInstance.isEmpty()) {
            const instance = this.app.create('block.listitem');
            prevInstance.getParent().insert({ position: 'append', instance: instance, type: 'input' });
            prevInstance.remove();

        }
        else {
            const instance = this._createItem();
            this.app.block.set(instance, 'start');
            this.app.broadcast('list.item', { instance: instance });
        }
    },
    _handleEnterAtEmptyOrEnd() {
        const selection = new TextRange(this.app);
        const item = selection.getBlockControlled();
        const prevInstance = (item) ? this.dom(item).dataget('instance') : false;
        if (prevInstance && !this.hasParentList() && prevInstance.isEmpty()) {
            const position = (this.isListEnd()) ? 'after' : 'split';
            this.getParent().insertEmpty({ position: position, caret: 'start', type: 'input' });
            prevInstance.remove();
        } else {
            const instance = this._createItem();
            this.app.block.set(instance, 'start');
            this.app.broadcast('list.item', { instance: instance });
        }
    },
    _handleEnterAtStart() {
        this._createItem('before');
        this.app.block.set(this);
    },
    _handleEnterInMiddle() {
        const splitter = new ElementSplitter(this.app);
        const $part = splitter.split(this.$block);
        const instance = this._createItem();
        instance.setContent($part.html());
        $part.remove();
        this.app.block.set(instance, 'start');
        this.app.broadcast('list.item', { instance: instance });
    },
    _handleBackspaceDelete() {
        const parent = this.getParent();
        const html = this.getContent();
        const newInstance = this.app.block.create(html);
        const parentList = this.getParent();
        this.remove();
        parent.getBlock().before(newInstance.getBlock());
        if (parentList.isEmpty(true)) {
            parentList.remove();
        }
        this.app.block.set(newInstance, 'start');
    },
    _handleForwardDelete() {
        const next = this.getParent().getNext();
        if (next) {
            if (next.isType('quote')) {
                const html = next.getBlock().text();
                this._insertHtml(html);
                next.remove();
            } else if (next.isEditable()) {
                const html = next.getHtml();
                this._insertHtml(html);
                next.remove();
            } else if (next.isType('todo')) {
                const $item = next.getFirstItem();
                const html = next.getFirstContent().html();
                $item.remove();
                this._insertHtml(html);
                if (next.isEmpty()) {
                    next.remove();
                }
            } else if (next.isType('list')) {
                const $blocks = next.getBlock().children();
                this.$block.append($blocks);
                next.remove();
            } else {
                this.app.block.set(next, 'start');
            }
        }
    },
    _traverse(direction, e, event) {
        const isBoundaryReached = (direction === 'prev')
            ? !this.isFirstElement() || !this.isCaretStart()
            : !this.isLastElement() || !this.isCaretEnd();

        if (isBoundaryReached) return;

        e.preventDefault();
        let parent = this.getParent();
        if (this.hasParentList()) {
            parent = this.getParentItem();
        }

        const getNextOrPrev = direction === 'prev' ? 'getPrev' : 'getNext';
        let next = parent[getNextOrPrev]();
        if (!next) {
            next = parent[getNextOrPrev + 'Parent']();
        }

        if (next) {
            this.app.block.set(next, direction === 'prev' ? 'end' : 'start');
        } else {
            this.app.block.set(parent);
            if (direction === 'prev') {
                const caret = new Caret(this.app);
                caret.set(parent.getFirstItem(), 'before');
            }
        }

        return true;
    },
    _createItem(position) {
        let instance = this.app.create('block.listitem');
        position = (position) ? position : 'after';
        this.$block[position](instance.getBlock());
        return instance;
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'noneditable', {
    mixins: ['block'],
    parser: false,
    props: {
        type: 'noneditable',
        focusable: true,
        editable: false,
        inline: false
    },
    defaults: {
        content: { getter: 'getContent', setter: 'setContent' }
    },
    create() {
        return this.dom('<div>').attr(this.opts.get('dataBlock'), 'noneditable');
    },

    // handle
    handleDelete(e, key, event) {
        if (!this.opts.is('noneditable.remove') && (event.is('delete') || event.is('backspace'))) {
            e.preventDefault();
            return true;
        }
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'pre', {
    mixins: ['block'],
    props: {
        type: 'pre',
        editable: true,
        inline: false,
        control: {
            'format': {
                position: { after: 'add', first: true }
            }
        }
    },
    defaults: {
        content: { getter: 'getContent', setter: 'setContent' },
        caption: { getter: 'getCaption', setter: 'setCaption' }
    },
    create() {
        return this.dom(this.opts.get('pre.template'));
    },
    parse() {
        this.parseCaption();
    },
    getCodeElement() {
        const $code = this.$block.find('code');
        const $pre = this.$block.find('pre');

        return $code.length ? $code : ($pre.length ? $pre : this.$block);
    },
    getPlainText() {
        return this._getPlainText(this.getCodeElement());
    },
    getContent() {
        return this.getCodeElement().html().trim();
    },
    getCaption() {
        return this.figcaption ? this.figcaption.getContent() : null;
    },
    setContent(value) {
        this.getCodeElement().html(value);
    },
    setCaption(caption) {
        if (this.figcaption) {
            this.figcaption.setContent(caption);
        } else {
            this._buildCaption(caption);
        }
    },
    setCaret(point) {
        const caret = new Caret(this.app);
        caret.set(this.getCodeElement(), point);
    },
    handleArrow(e, key, event) {
        let next = this.getNext();
        if (!next && this.isCaretEnd() && event.is('down')) {
            e.preventDefault();
            let instance = this.app.block.create();
            this.insert({ instance: instance, position: 'after', caret: 'start', remove: false, type: 'input' });
            return true;
        }
    },
    handleTab(e) {
        e.preventDefault();
        this._insertSpaces(this.opts.get('pre.spaces'));
        return true;
    },
    handleEnter(e) {
        e.preventDefault();
        this._insertNewlineIfNeeded();
        return true;
    },

    // private
    _insertNewlineIfNeeded() {
        const last = this.$block.html().search(/\n$/);
        const insertion = new Insertion(this.app);

        if (this.isCaretEnd() && last === -1) {
            insertion.insertNewline('after', true);
        } else {
            insertion.insertNewline();
        }
    },
    _insertSpaces(numSpaces) {
        const node = document.createTextNode(' '.repeat(numSpaces));
        const insertion = new Insertion(this.app);
        insertion.insertNode(node, 'end');
        this._fixDoubleNewlines();
    },
    _fixDoubleNewlines() {
        const selection = new TextRange(this.app);
        const prev = selection.getCurrent().previousSibling;
        const text = prev && prev.textContent;

        if (text && text.search(/\n\n/g) !== -1) {
            prev.textContent = text.replace(/\n\n/g, '\n');
        }
    },

});
/*jshint esversion: 6 */
Redactor.add('block', 'quote', {
    mixins: ['block'],
    props: {
        type: 'quote',
        editable: true,
        inline: false,
        control: {
            'format': {
                position: { after: 'add', first: true }
            }
        }
    },
    defaults: {
        content: { getter: 'getContent', setter: 'setContent' },
        caption: { getter: 'getCaption', setter: 'setCaption' }
    },
    create() {
        return this.dom(this.opts.get('quote.template'));
    },
    parse() {
        this._parseItem();
        this._parseCaption();
    },
    build() {
        this._parseItem();
        this._parseCaption();
    },
    isEmpty(trim) {
        return this._isEmpty(this.getCurrentItem(), trim);
    },
    getPlaceholder() {
        return this.getItem().attr('data-placeholder');
    },
    getCurrentItem() {
        const selection = new TextRange(this.app);
        return this._isCaption(selection.getParent()) ? this.$quotecaption : this.$quoteitem;
    },
    getItem() {
        return this.$quoteitem;
    },
    setCaret(point) {
        const caret = new Caret(this.app);
        caret.set(this.$quoteitem, point);
    },
    setContent(value) {
        this.$quoteitem.html(value);
    },
    setEmpty() {
        this.getCurrentItem().html('');
    },
    setPlaceholder(value) {
        this._setAttr(this.getItem(), 'data-placeholder', value);
    },
    setCaption(caption) {
        this.$quotecaption.html(caption);
    },
    getContent() {
        return this.$quoteitem.html();
    },
    getCaption() {
        return this.$quotecaption ? this.$quotecaption.html() : null;
    },

    // handle
    handleDelete(e, key, event) {
        const caret = new Caret(this.app);
        const selection = new TextRange(this.app);
        const utils = new Utils(this.app);
        let item = this._getItemFromSelection(selection);
        let caption = this._getCaptionFromSelection(selection);
        let $caption = this.dom(caption);
        let prev = this.getPrev();

        // caption
        if (event.is('backspace') && this._isCaption(caption) && caret.is(caption, 'start')) {
            if (utils.isEmptyHtml($caption.html()) && !$caption.attr('data-placehoder')) {
                e.preventDefault();
                this.$quotecaption.remove();
                return true;
            }

            e.preventDefault();
            this.$quotecaption.find('br').remove();
        }
        else if (event.is('delete') && this._isCaption(caption) && caret.is(caption, 'end')) {
            e.preventDefault();
        }
        else if (event.is('delete') && this._isItem(item) && caret.is(item, 'end')) {
            e.preventDefault();
        }
        else if (event.is('backspace') && this._isItem(item) && caret.is(item, 'start') && prev && prev.isEditable()) {
            e.preventDefault();
            this.app.block.set(prev, 'end');
            this._insertHtml(this.getPlainText());
            this.remove();
        }

        return true;
    },
    handleArrow(e, key, event) {
        let next = this.getNext();
        if (!next && this.isCaretEnd() && event.is('down')) {
            e.preventDefault();
            this._createNewInputAfter();
            return true;
        }
    },
    handleEnter(e) {
        e.preventDefault();
        const selection = new TextRange(this.app);
        const insertion = new Insertion(this.app);
        const caret = new Caret(this.app);
        let caption = this._getCaptionFromSelection(selection);
        let caretEnd = caret.is(caption, 'end');

        if (this._isCaption(caption)) {
            if (caretEnd) {
                e.preventDefault();
                this._createNewInputAfter();
            } else if (this.$quotecaption.tag('cite')) {
                insertion.insertBreakline(false, false);
            }
        } else {
            insertion.insertBreakline();
        }

        return true;
    },

    // private
    _createNewInputAfter() {
        let instance = this.app.block.create();
        this.insert({ instance, position: 'after', caret: 'start', remove: false, type: 'input' });
    },
    _isCaption(el) {
        return (el && this.$quotecaption && el === this.$quotecaption.get());
    },
    _isItem(el) {
        return (el && el === this.$quoteitem.get());
    },
    _getItemFromSelection(selection) {
        return selection.getBlock();
    },
    _getCaptionFromSelection(selection) {
        let isCite = this.$quotecaption && this.$quotecaption.tag('cite');
        return (isCite) ? selection.getClosest('cite') : selection.getParent();
    },
    _parseItem() {
        this.$quoteitem = this.$block.find('p').first();
        if (this.$quoteitem.length === 0) {
            this.$quoteitem = this.$block;
        }
    },
    _parseCaption() {
        let $caption = (this.isFigure()) ? this.$block.find('figcaption') : this.$block.find('p').last();
        let $cite = $caption.find('cite');

        this.$quotecaption = $cite.length ? $cite : ($caption.length ? $caption : false);
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'table', {
    mixins: ['block'],
    nested: 'td, th',
    props: {
        type: 'table',
        focusable: true,
        inline: false,
        control: {
            'table': {
                position: { after: 'add' }
            }
        }
    },
    defaults: {
        head: { getter: 'getHead' },
        foot: { getter: 'getFoot' },
        items: { getter: 'getItems' }
    },
    create() {
        return this.dom(this.opts.get('table.template'));
    },
    build() {
        this._buildItems();
        this._parseAndBuild();
        this.fillEmpty();
    },
    parse() {
        this._parseAndBuild();
    },
    setCaret(point) {
        const $el = (point === 'start') ? this.getFirstBlock() : this.getLastBlock();
        this.app.block.set($el, point);
    },
    getFirstBlock() {
        return this.getFirstCell().children().first();
    },
    getFirstCell() {
        return this.$block.find('th, td').first();
    },
    getLastBlock() {
        return this.getLastCell().children().last();
    },
    getLastCell() {
        return this.$block.find('th, td').last();
    },
    getRows() {
        return this.$block.find('tr');
    },
    getCells() {
        return this.$block.find('th, td');
    },
    getHead() {
        return this.$block.find('thead').length > 0;
    },
    getFoot() {
        return this.$block.find('tfoot').length > 0;
    },
    getItems() {
        const blockTags = this.opts.get('tags.block').join(',');
        const $rows = this.$block.find('tr');
        let items = [];

        $rows.each(($row) => {
            let rowData = [];
            $row.find('th, td').each(($cell) => {
                $cell = $cell.clone();
                $cell = this.unparseInlineBlocks($cell);
                $cell.find(blockTags).unwrap();
                rowData.push($cell.html().trim());
            });
            items.push(rowData);
        });

        return items;
    },
    fillEmpty() {
        this.getCells().each(function($node) {
            let instance = $node.dataget('instance');
            if (instance.isEmpty()) {
                let emptyInstance = this.app.block.create();
                $node.append(emptyInstance.getBlock());
            }
        }.bind(this));
    },

    // private
    _parseAndBuild() {
        this._buildNowrap();

        this.parseItems('tr', 'row');
        this.parseItems('td, th', 'cell');
    },
    _buildItems() {
        const items = this.data.get('items');
        if (!items) {
            return;
        }

        const hasHead = this.data.get('head');
        const hasFoot = this.data.get('foot');
        const totalItems = items.length;

        const $head = hasHead ? this.dom('<thead>') : null;
        const $body = this.dom('<tbody>');
        const $foot = hasFoot ? this.dom('<tfoot>') : null;

        items.forEach((item, index) => {
            const isFirst = index === 0;
            const isLast = index === totalItems - 1;
            const $row = this.dom('<tr>');

            // Determine where to append the row
            if (isFirst && hasHead) {
                $head.append($row);
            } else if (isLast && hasFoot) {
                $foot.append($row);
            } else {
                $body.append($row);
            }

            // Populate the row with cells
            item.forEach(content => {
                const cellTag = (isFirst && hasHead) ? 'th' : 'td';
                const $cell = this.dom(`<${cellTag}>`);
                const textBlock = this.app.create('block.text', { table: true });

                textBlock.getBlock().html(content);
                $cell.append(textBlock.getBlock());
                $row.append($cell);
            });
        });

        // Clear the block and append constructed parts
        this.$block.empty();
        if (hasHead) this.$block.append($head);
        this.$block.append($body);
        if (hasFoot) this.$block.append($foot);
    },
    _buildNowrap() {
        let nowrap = this.opts.get('table.nowrap');
        this.$block.find('th, td').filter('.' + nowrap).addClass('rx-nowrap');
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'cell', {
    mixins: ['block'],
    props: {
        type: 'cell',
        inline: false,
        focusable: true,
        reorder: false,
        control: {
            'table': {
                position: { after: 'add' }
            }
        }
    },
    defaults: {
        content: { getter: 'getContent', setter: 'setContent' },
        width: { getter: 'getWidth', setter: 'setWidth' },
        nowrap: { getter: 'getNowrap', setter: 'setNowrap' }
    },
    create() {
        return this.dom('<td>');
    },
    getTable() {
        return this.getClosest('table');
    },
    getRow() {
        return this.getClosest('row');
    },
    getNextCell() {
        return this._getSiblingCell('getNext', 'getNextRow', 'getFirst');
    },
    getPrevCell() {
        return this._getSiblingCell('getPrev', 'getPrevRow', 'getLast');
    },
    getFirstElement() {
        return this.$block.find('[data-rx-type]').first();
    },
    getWidth() {
        return this.$block.attr('width') || '';
    },
    getNowrap() {
        return this.$block.hasClass('rx-nowrap');
    },
    setWidth(value) {
        this._applyToEachCell($cell => {
            value = value.endsWith('%') ? value : value.replace('px', '');
            value ? $cell.attr('width', value) : $cell.removeAttr('width');
        });
    },
    setNowrap(value) {
        const classes = this.opts.get('table.nowrap') + ' rx-nowrap';
        this._applyToEachCell($cell => value ? $cell.addClass(classes) : $cell.removeClass(classes));
    },
    setEmpty() {
        let emptyInstance = this.app.block.create();
        this.$block.html('');
        this.$block.append(emptyInstance.getBlock());
    },
    setCaret(point) {
        const caret = new Caret(this.app);
        caret.set(this.getFirstElement(), point);
    },
    isLastElement() {
        const $last = this.getTable().getBlock().find('th, td').last();
        return (this.$block.get() === $last.get());
    },
    handleTab(e) {
        e.preventDefault();
        const next = this.getNextCell() || this.getClosest('table').getNext();
        if (next) {
            this.app.block.set(next, 'start');
        }

        return true;
    },

    // private
    _getSiblingCell(cellNearMethod, rowMethod, cellMethod) {
        let cell = this[cellNearMethod]();
        if (!cell) {
            const row = this.getRow();
            const siblingRow = row && row[rowMethod]();
            cell = siblingRow && siblingRow[cellMethod]('cell');
        }
        return cell;
    },
    _applyToEachCell(callback) {
        const index = this._getCellIndex();
        this.getTable().getBlock().find('tr').each(($row, i) => {
            const $cell = this.dom($row.get().cells[index]);
            callback($cell);
        });
    },
    _getCellIndex() {
        const cells = this.$block.closest('tr').find('td, th').all();
        const cellsArray = Array.from(cells);

        return cellsArray.indexOf(this.$block.get());
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'row', {
    mixins: ['block'],
    props: {
        type: 'row',
        inline: false,
        focusable: true,
        control: false
    },
    create() {
        return this.dom('<tr>');
    },
    setCaret(point) {
        const caret = new Caret(this.app);
        caret.set(this.getFirstElement(), point);
    },
    getTable() {
        return this.getClosest('table');
    },
    getFirstElement() {
        return this.$block.find('td, th').first().find('[data-rx-type]').first();
    },
    getLastElement() {
        return this.$block.find('td, th').last().find('[data-rx-type]').first();
    },
    getNextRow() {
        return this._getAdjacentRow('next');
    },
    getPrevRow() {
        return this._getAdjacentRow('prev');
    },

    // =private
    _getAdjacentRow(direction) {
        let row = this[direction === 'next' ? 'getNext' : 'getPrev']();
        let $parent = this.$block.parent();

        if (!row && !$parent.tag('table')) {
            let method = direction === 'next' ? 'nextElement' : 'prevElement';
            row = $parent[method]().find('tr')[direction === 'next' ? 'first' : 'last']().dataget('instance');
        }

        return row;
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'text', {
    mixins: ['block'],
    props: {
        type: 'text',
        editable: true,
        inline: false,
        control: {
            'format': {
                position: { after: 'add', first: true }
            }
        }
    },
    defaults: {
        content: { getter: 'getContent', setter: 'setContent' }
    },
    create() {
        return this.params.table ? this.dom('<div data-rx-tag="tbr">') :
               this.opts.is('breakline') ? this.dom('<div data-rx-tag="br">') :
               this.dom(`<${this.opts.get('markup')}>`);
    },
    handleEnter(e) {
        e.preventDefault();
        let clone;

        // empty or end
        if (this.isEmpty() || this.isCaretEnd()) {
            clone = this._createNewBlockForEnter();
            this.insert({ instance: clone, position: 'after', caret: 'start', remove: false, type: 'input' });
        } else if (this.isCaretStart()) {
            clone = this._createNewBlockForEnter();
            this.insert({ instance: clone, position: 'before', type: 'input' });
        } else {
            const splitter = new ElementSplitter(this.app);
            const $block = this.getBlock();
            const $part = splitter.split($block);
            this.app.block.set($part, 'start');
            this.app.emit('block.split', { element: $part.get() });
        }

        return true;
    },

    // =private
    _createNewBlockForEnter() {
        let clone = this.$block.attr('data-rx-tag') === 'tbr' ?
                    this.app.create('block.text', { table: true }) :
                    this.app.block.create();

        if (!this.opts.is('clean.enter')) {
            clone = this.duplicateEmpty();
            clone.getBlock().removeAttr('id');
        }

        if (this.opts.is('clean.enterinline')) {
            clone = this._cloneInline(clone);
        }

        return clone;
    },
    _cloneInline(clone) {
        const selection = new TextRange(this.app);
        const inspector = new ElementInspector(this.app);
        const inline = selection.getInline();

        if (inline) {
            let inlines = inspector.getInlines(inline);
            let cloned = null;

            inlines.forEach((inlineElement, index) => {
                if (inlineElement.tagName === 'A') return;

                let clonedInline = inlineElement.cloneNode();
                clonedInline.removeAttribute('id');
                clonedInline.innerHTML = '';

                cloned = index === 0 ? null : clonedInline;
            });

            if (cloned) {
                clone = this.app.block.create(cloned.outerHTML);
            }
        }

        return clone;
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'todo', {
    mixins: ['block'],
    props: {
        type: 'todo',
        focusable: true,
        inline: false,
        control: {
            'format': {
                position: { after: 'add', first: true }
            }
        }
    },
    defaults: {
        items: { getter: 'getItems' }
    },
    create() {
        let $el = this.dom('<ul>');
        let items = this.data.get('items');
        if (!items) {
            let item = this.app.create('block.todoitem');
            $el.append(item.getBlock());
        }
        return $el;
    },
    parse() {
        this.parseItems('li', 'todoitem');
    },
    build() {
        this._buildItems();
        this.parseItems('li', 'todoitem');
    },
    setCaret(point) {
        let $el = (point === 'start') ? this.getFirstItem() : this.getLastItem();
        this.app.block.set($el, point);
    },
    getItems() {
        return this.$block.children().all().map(node => {
            let instance = this.dom(node).dataget('instance');
            return {
                content: instance.getContent(),
                checked: instance.getChecked()
            };
        });
    },
    getFirstItem() {
        return this.$block.children().first();
    },
    getFirstItemInstance() {
        return this.getFirstItem().dataget('instance');
    },
    getFirstContent() {
        return this.getFirstItem().find('div').first();
    },
    getLastItem() {
        return this.$block.children().last();
    },
    getLastItemInstance() {
        return this.getLastItem().dataget('instance');
    },
    getLastContent() {
        const utils = new Utils(this.app);
        const itemTag = utils.findTodoItemTag();
        return this.getLastItem().find(itemTag).last();
    },

    // private
    _buildItems() {
        let items = this.data.get('items');
        if (items) {
            items.forEach(item => {
                let instance = this.app.create('block.todoitem', item);
                this.$block.append(instance.getBlock());
            });
        }
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'todoitem', {
    mixins: ['block'],
    props: {
        type: 'todoitem',
        inline: false,
        editable: true,
        control: {
            'format': {
                position: { after: 'add', first: true }
            }
        }
    },
    defaults: {
        content: { setter: 'setContent', getter: 'getContent' },
        checked:  { setter: 'setChecked', getter: 'getChecked' }
    },
    create() {
        return this.dom('<li>');
    },
    parse() {
        this._parse();
    },
    build() {
        this.$block.html(this.opts.get('todo.templateItem'));
        this._parse();
    },
    setCaret(point) {
        const caret = new Caret(this.app);
        caret.set(this.$content, point);
    },
    isFirstElement() {
        return (this.$block.prevElement().length === 0);
    },
    isLastElement() {
        return (this.$block.nextElement().length === 0);
    },
    isListEnd() {
        return this.getParent().isCaretEnd();
    },
    getContentItem() {
        return this.$content;
    },
    getParent() {
        return this.$block.parent().closest(this._buildTraverseSelector('todo')).dataget('instance');
    },
    getContent() {
        let $clone = this.unparseInlineBlocks(this.$content.clone());
        return $clone.html().trim();
    },
    getChecked() {
        return this.$block.attr('data-checked') === '1';
    },
    setContent(content) {
        this.$content.html(content);
    },
    setChecked(value) {
        this.$input.attr('checked', value);
        this.$block.attr('data-checked', (value) ? '1' : '0');
    },
    setPlaceholder(value) {
        this.$content.attr('data-placeholder', value);
    },
    setEmpty() {
        this.$content.html('');
    },

    // handle
    handleArrow(e, key, event) {
        if (event.is('left') && this.isCaretStart() || event.is('up')) {
            return this._traverse(e, 'prev');
        }
        else if (event.is('right') && this.isCaretEnd() || event.is('down')) {
            return this._traverse(e, 'next');
        }
    },
    handleDelete(e, key, event) {
        if (event.is('delete')) {
            return this._handleDeleteForward(e);
        }
        else if (event.is('backspace')) {
            return this._handleDeleteBackward(e);
        }
    },
    handleTab(e) {
        return this._traverse(e, 'next');
    },
    handleEnter(e) {
        e.preventDefault();

        if (this.isEmpty() || this.isCaretEnd()) {
            this._handleEmptyOrEnd();
        } else if (this.isCaretStart()) {
            this._createAndSetItem('before');
        } else {
            this._handleContentSplit();
        }

        return true;
    },

    // private
    _handleDeleteForward(e) {
        let next = this.getNext();
        let parent = this.getParent();

        if (this.isCaretEnd() && next && next.isType('todoitem')) {
            e.preventDefault();
            this._insertItem('delete', next);
            return true;
        }
        else if (this.isCaretEnd() && this.isLastElement()) {
            next = this.getNextParent();

            if (next) {
                e.preventDefault();
                if (next.isType('quote')) {
                    let html = next.getBlock().text();
                    this._insertHtml(html, false);
                    next.remove();
                }
                else if (next.isEditable()) {
                    let html = next.getHtml();
                    this._insertHtml(html, false);
                    next.remove();
                }
                else if (next.isType('todo')) {
                    let $blocks = next.getBlock().children();
                    parent.getBlock().append($blocks);
                    next.remove();
                }
                else if (next.isType('list')) {
                    let $item = next.getBlock().children().first();
                    let html = $item.html();
                    $item.remove();
                    this._insertHtml(html, false);
                    if (next.isEmpty()) {
                        next.remove();
                    }
                }
                else {
                    this.app.block.set(next, 'start');
                }

                return true;
            }
        }
    },
    _handleDeleteBackward(e) {
        let next = this.getNext();
        let prev = this.getPrev();
        let parent = this.getParent();

        if (this.isCaretStart() && prev && prev.isType('todoitem')) {
            e.preventDefault();
            this._insertItem('backspace', prev);
            return true;
        }
        else if (this.isCaretStart() && this.isFirstElement()) {
            next = this.getPrevParent();

            if (next) {
                e.preventDefault();
                if (next.isEditable()) {
                    let html = this.getContent();
                    this.app.block.set(next, 'end');
                    this._insertHtml(html);
                    this.remove();
                    if (parent.isEmpty()) {
                        parent.remove();
                    }
                }
                else if (next.isType('todo')) {
                    let $blocks = parent.getBlock().children();
                    next.getBlock().append($blocks);
                    this.app.block.set($blocks.first(), 'start', true);
                    parent.remove();
                }
                else if (next.isType('list')) {
                    let html = this.getContent();
                    let $item = next.getLastItem();
                    this.app.block.set($item , 'end');
                    this._insertHtml(html);
                    this.remove();
                    if (parent.isEmpty()) {
                        parent.remove();
                    }
                }
                else {
                    this.app.block.set(next, 'start');
                }
                return true;
            }
        }
    },
    _insertItem(type, target) {
        let content;
        if (type === 'delete') {
            content = target.getPlainText();
            target.remove();
        } else {
            content = this.getPlainText();
            this.remove();
            this.app.block.set(target, 'end');
        }
        this._insertHtml(content, false);
    },
    _handleEmptyOrEnd() {
        const selection = new TextRange(this.app);
        const item = selection.getBlockControlled();
        const prev = item ? this.dom(item).dataget('instance') : false;

        if (prev && this.isListEnd() && prev.isEmpty()) {
            this.getParent().insertEmpty({ position: 'after', caret: 'start', type: 'input' });
            prev.remove();
        } else {
            this._createAndSetItem();
        }
    },
    _handleContentSplit() {
        const splitter = new ElementSplitter(this.app);
        const $part = splitter.split(this.$content);
        const instance = this._createItem();
        instance.setContent($part.html());
        $part.remove();
        this.app.block.set(instance, 'start');
    },
    _createAndSetItem(position = 'after') {
        const instance = this._createItem(position);
        this.app.block.set(instance, 'start');
    },
    _traverse(e, type) {
        e.preventDefault();
        const isEnd = type === 'next';
        const boundaryMethod = isEnd ? 'isLastElement' : 'isFirstElement';
        const getDirection = isEnd ? 'getNext' : 'getPrev';
        const getParentDirection = isEnd ? 'getNextParent' : 'getPrevParent';
        const setCaretPosition = isEnd ? 'start' : 'end';

        let parent = (this[boundaryMethod]()) ? this.getParent() : this;
        let next = parent[getDirection]();

        if (next) {
            this.app.block.set(next, setCaretPosition);
            return;
        } else {
            next = parent[getParentDirection]();
            if (next) {
                this.app.block.set(next, setCaretPosition);
                return;
            }
        }

        return true;
    },
    _createItem(position) {
        let instance = this.app.create('block.todoitem');
        position = (position) ? position : 'after';
        this.$block[position](instance.getBlock());
        return instance;
    },
    _parse() {
        let html = this.$block.html();
        let ph = this.$block.attr('data-placeholder');
        let itemTemplate = this.opts.get('todo.templateItem');
        let itemDoneTemplate = this.opts.get('todo.templateItemDone');
        let $input = this.$block.find('input');
        const utils = new Utils(this.app);
        let itemTag = utils.findTodoItemTag();
        let $content = this.$block.find(itemTag);

        this.$input = ($input.length !== 0) ? $input : this.dom(this.opts.get('todo.templateInput'));
        this.$input.attr('tabindex', '-1');

        this.$content = ($content.length !== 0) ? $content : this.dom(this.opts.get('todo.templateContent'));
        this.$content.attr('contenteditable', true);

        if (ph) {
            this.setPlaceholder(ph);
        }

        // Update the input and block state based on the item templates
        let template = this.opts.get('todo.template');
        if (template) {
            html = this._extractCheckboxContent(html, itemTemplate, itemDoneTemplate);
        }
        this._updateItemState(html, $input, $content, itemTemplate, itemDoneTemplate);

        // Append elements if they were newly created
        this._appendNewElements($input, $content);

        // Set event
        this.$input.on('click.rx-todo', this._clickInput.bind(this));

        // firefox fix
        this.$input.on('pointerdown.rx-todo', this._clickInput.bind(this));
    },
    _updateItemState(html, $input, $content, itemTemplate, itemDoneTemplate) {
        let itemTemplateTrim = itemTemplate.replace(/\s/g, '');
        const toggleClass = this.opts.get('todo.toggleClass');
        let val;
        if (html.startsWith(itemDoneTemplate)) {
            html = html.replace(itemDoneTemplate, '');
            val = '1';
            this._setAttributes(true, val);
        }
        else if (html.startsWith(itemTemplateTrim) || html.startsWith(itemTemplate)) {
            html = html.replace(html.startsWith(itemTemplateTrim) ? itemTemplateTrim : itemTemplate, '');
            val = '0';
            this._setAttributes(false, val);
        }

        if (toggleClass) {
            this.$block.toggleClass(toggleClass, val === '1');
        }

        if ($input.length === 0 && $content.length === 0) {
            html = html.trim();
            this.$content.html(html);
            this.$block.html('');
        }
    },
    _setAttributes(checked, dataChecked) {
        this.$input.attr('checked', checked);
        this.$block.attr('data-checked', dataChecked);
    },
    _appendNewElements($input, $content) {
        if ($input.length === 0) this.$block.append(this.$input);
        if ($content.length === 0) this.$block.append(this.$content);
    },
    _clickInput(e) {
        e.preventDefault();
        e.stopPropagation();
        if (this.app.event.isPaused()) return;

        this.$input.get().checked = !this.$input.get().checked;
        this.app.block.set(this.$block);
        let val = (this.$input.attr('checked')) ? '1' : '0';
        this.$block.attr('data-checked', val);

        const toggleClass = this.opts.get('todo.toggleClass');
        if (toggleClass) {
            this.$block.toggleClass(toggleClass, val === '1');
        }
    },
    _extractCheckboxContent(html, checkboxUnchecked, checkboxChecked) {
        const utils = new Utils(this.app);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const cleanedText = tempDiv.textContent || '';
        const escapedUnchecked = utils.escapeRegExp(checkboxUnchecked);
        const escapedChecked = utils.escapeRegExp(checkboxChecked);
        const regex = new RegExp('(' + escapedUnchecked + '|' + escapedChecked + ')\\s*(.*)', 'g');
        const match = regex.exec(cleanedText);

        return match ? match[0].trim() : html;
    }
});
/*jshint esversion: 6 */
Redactor.add('block', 'mergetag', {
    mixins: ['block'],
    props: {
        type: 'mergetag',
        editable: false,
        control: false,
        inline: true,
        context: true
    },
    defaults: {
        content: { getter: 'getContent', setter: 'setContent' }
    },
    create() {
        return this.dom('<span>').attr(this.opts.get('dataBlock'), 'mergetag');
    }
});

    window.Redactor = Redactor;

    // Data attribute load
    window.addEventListener('load', function() {
        Redactor('[data-redactor]');
    });

    // Export for webpack
    if (typeof module === 'object' && module.exports) {
        module.exports = Redactor;
        module.exports.Redactor = Redactor;
    }
}());