Redactor.add('plugin', 'private', {
  subscribe: {
    'private.toggle': function () {
      this.toggle();
    },
  },
  init() {
    this.enabled = $('input[name="private"]').val() == 1 ? 1 : 0 // Get initial state from input field
    this.publicButton = {
      title: 'Disable private reply',
      icon: `<i class="fas fa-eye"></i>`,
      command: 'private.toggle',
      position: {'before': 'shortcut'},
      observer: 'private.observe' // Observe this.enabled to toggle button
    };
    this.privateButton = {
      title: 'Enable private reply',
      icon: `<i class="fas fa-eye-slash"></i>`,
      command: 'private.toggle',
      position: {'before': 'shortcut'},
      observer: 'private.observe' // Observe this.enabled to toggle button
    };
  },
  start() {
    // this.app.extrabar.add('public', this.publicButton);
    // this.app.extrabar.add('private', this.privateButton);
    this.updateButtons('start');
    this.updateToolbar();
  },
  updateButtons(subscribe){
    // this.app.extrabar.remove('public'); // Doesn't seem to work, or requires delay to work
    // this.app.extrabar.remove('private'); // Doesn't seem to work, or requires delay to work
    this.app.extrabar.add('private', this.privateButton);
    this.app.extrabar.add('public', this.publicButton);
  },
  observe(obj, name) {
    console.log('Observe() update');
    switch(name) {
      case 'private':
        if (this.enabled === 1) {
          console.log('Observe() showing private button');
          return obj;
        }
        console.log('Observe() hiding private button');
        break;
      case 'public':
        if (this.enabled === 0) {
          console.log('Observe() showing public button');
          return obj;
        }
        console.log('Observe() hiding public button');
        break;
      default:
        console.log('Observe() no action for:', name);
        return obj;
    }
  },
  forceUpdate() {
    // alert('forceupdate'); 
  },
  toggle() {
    this.enabled = this.enabled ? 0 : 1;
    console.log('private.toggle', this.enabled);
    this.updateToolbar();
    this.updateButtons('toggle');
    // this.app.broadcast('observer.change'); // Doesn't seem to force re rendering of buttons
  },
  enable() {
    console.log('private.enable');
    this.enabled = 1;
    this.updateToolbar();
  },
  disable() {
    console.log('private.disable');
    this.enabled = 0;
    this.updateToolbar();
  },
  updateToolbar() {
    console.log('Updating toolbar for private reply, enabled:', this.enabled);
    setTimeout(() => {
      $('input[name="private"]').val(this.enabled); // Update the input field value
      if (this.enabled == 1){
        $('.reply-box .rx-toolbar-container').addClass('private');
        $('#ticket_carbon_copy_form').hide();
        $('.reply_type').hide();
      } else {
        $('.reply-box .rx-toolbar-container').removeClass('private');
        $('#ticket_carbon_copy_form').show();
        $('.reply_type').show();
      }
    }, 100); // Requires a timeout for some reason?
  }
});