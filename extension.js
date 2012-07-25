const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const Clutter = imports.gi.Clutter;
const MessageTray = imports.ui.messageTray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

PopupMenu.PopupImageMenuItem.prototype.setIconType = function(type) {
	if (type !== undefined) {	
		this._icon.set_icon_type(type);
	} else {
		this._icon.set_icon_type(St.IconType.SYMBOLIC);
	}
}


function stock(metadata) {
	this.file = metadata.path + '/companies.list';
	this._init();
}

stock.prototype = {
	__proto__: PanelMenu.Button.prototype,

	_init: function() {
		PanelMenu.Button.prototype._init.call(this, St.Align.START);
		this.menubutton = new St.Icon({ icon_name: 'share-stock',
				icon_type: St.IconType.SYMBOLIC,
				style_class: 'system-status-icon' });

		this.actor.add_actor(this.menubutton);
		this.menu.connect('open-state-changed', Lang.bind(this, this.refresh_list));
		this._update();	
	},

	enable: function() {
			Main.panel._rightBox.insert_child_at_index(this.actor, 0);
			Main.panel._menus.addMenu(this.menu);
			let fileM = Gio.file_new_for_path(this.file);
			this.monitor = fileM.monitor(Gio.FileMonitorFlags.NONE, null);
			this.monitor.connect('changed', Lang.bind(this, this._update));
	},

	disable: function() {
			Main.panel._rightBox.remove_child(this.actor);
			Main.panel._menus.removeMenu(this.menu);
			this.monitor.cancel();
	},

	read_file: function() {
			if (GLib.file_test(this.file, GLib.FileTest.EXISTS)) {
				let content = Shell.get_file_contents_utf8_sync(this.file);
				return content.toString().split('\n').slice(0,-1);
			} else {
				return ['No Companies defined in: ' + this.file]
			}
	},

	_update: function() {
		let CompanyMenu = this.menu;
		let panelbutton = this.menubutton;
		let companylist = this.file;
		panelbutton.set_icon_name("share-stock");
		CompanyMenu.removeAll()
		companies = this.read_file();
		for each(company in companies){
			CompanyMenu.addMenuItem(add_new_item(company));
		}
		// Separator
		this.Separator = new PopupMenu.PopupSeparatorMenuItem();
		CompanyMenu.addMenuItem(this.Separator);
		
		// Bottom section
		let bottomSection = new PopupMenu.PopupMenuSection();
		
		this.newCompany = new St.Entry(
		{
			name: "newCompanyEntry",
			hint_text: _("New Stock Code"),
			track_hover: true,
			can_focus: true
		});
		let entryNewCompany = this.newCompany.clutter_text;
		entryNewCompany.connect('key-press-event', 
			function(o,e) {
				let symbol = e.get_key_symbol();
		    	if (symbol == Clutter.Return) {
					CompanyMenu.close();
					panelbutton.set_icon_name("view-refresh");
					add_new_item(o.get_text());
					add_new_item_to_file(o.get_text(),companylist);
					entryNewCompany.set_text('');
				}
			}
		);
		
		bottomSection.actor.add_actor(this.newCompany);
		bottomSection.actor.add_style_class_name("newCompanySection");
		CompanyMenu.addMenuItem(bottomSection);
	},
	
	refresh_list: function(actor,event){
		for each(menuitem in actor._getMenuItems().slice(0,-2)){
			company = menuitem.actor.get_children()[0].get_text();
	//		global.log("updating info for " + company);
			info = get_current_info(company);
	//		global.log("updating text");
			this.update_text(menuitem,info);
	//		global.log("Update Finished");
		}
	},

	update_text: function(menuitem,info) {
		// update text & icon
		menuitem.actor.get_children()[1].set_icon_name(info['icon_name'])
		menuitem.actor.get_children()[2].get_children()[0].set_text(info['price'])
		menuitem.actor.get_children()[2].get_children()[1].set_text(' ' + info['change'])	
		menuitem.actor.get_children()[2].get_children()[2].set_text(' (' + info['pchange'] + ')')		
		// add styling
		menuitem.actor.get_children()[2].get_children()[1].set_style(info['style'])	
		menuitem.actor.get_children()[2].get_children()[2].set_style(info['style'])	
	},
};

function get_current_info(company) {
	url = Gio.file_new_for_uri('http://www.google.com/finance/info?q='+company);
	try {
		loaded = url.load_contents(null)[0]
	} catch (e if e instanceof BadRequest) {
		global.log("Invalid URI:" + url.get_uri())
		return "Invalid Name"
	}
	j = {}
	if (loaded === true){
		str = String(url.load_contents(null)[1])
		j = JSON.parse(str.slice(6,-2));
	} else {
		prev_company = company.get_text()
		prev_p = price.get_text()
		j = {'c':'grey','t': prev_company,'l':prev_p,'cp':'grey'};
	}
	info = {'price':j['l'],'change':j['c'],'pchange':j['cp']}
	if (Number(j['c']) > 0){
		info['icon_name'] = 'share-up'
		info['style'] = 'color:#00CC00;'
	}
	else if (Number(j['c']) === 0){
		info['icon_name'] = 'share-neutral'
		info['style'] = ''
	}
	else if (Number(j['c']) < 0){
		info['icon_name'] = 'share-down'
		info['style'] = 'color:#CC0000;'
	}
	else {
		info['icon_name'] = 'error'
		info['style'] = ''
		info['price'] = 'Error getting data...'
	}
  	//global.log('got info');
	return info;
}

function add_new_item_to_file(name,file) {
	global.log(name + ' ' + file);
	if (GLib.file_test(file, GLib.FileTest.EXISTS))
	{
		let content = Shell.get_file_contents_utf8_sync(file);
		content = content + name + "\n";
		global.log(content);
		
		let f = Gio.file_new_for_path(file);
		let out = f.replace(null, false, Gio.FileCreateFlags.NONE, null);
		Shell.write_string_to_stream (out, content);
	}
	else 
	{ global.logError("share price : Error while reading file : " + file); }
}

function add_new_item(name) {
	this.button = new St.BoxLayout({ style_class: 'panel-button',
		reactive: true,
		can_focus: true,
		track_hover: true });
	this.status_icon = new St.Icon({ icon_name: 'share-neutral',
		icon_type: St.IconType.FULLCOLOR,
		style_class: 'system-status-icon' });

	this.price = new St.Label({ style_class: 'status-label', text: '?'});
	this.change = new St.Label({style_class: 'status-label' ,text:' --'});
	this.pchange = new St.Label({style_class: 'status-label' ,text:' (?) '});
	remove_icon = new St.Icon({ icon_name: 'edit-delete',
		icon_type: St.IconType.SYMBOLIC,
		style_class: 'system-status-icon' });
	remove_icon.connect('button-press-event',remove_item);

	this.button.insert_child_at_index(this.price,2);
	this.button.insert_child_at_index(this.change,3);
	this.button.insert_child_at_index(this.pchange,4);

	item = new PopupMenu.PopupImageMenuItem(name,"share-neutral");
	item.setIconType(St.IconType.FULLCOLOR);
	item.addActor(this.button);
	item.addActor(remove_icon);
	return item
}

function remove_item(actor) {
	global.log("EVENT");
	global.log(actor.get_parent());
}

function init(metadata) {
	return new stock(metadata);
}



