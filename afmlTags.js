let headRequests = {};
function requestHead(url) {
	if (new URL(url, document.baseURI).origin !== document.location.origin) return new Promise((resolve) => resolve({ status: 0 }));
	return headRequests[url] ??= fetch(url, {method: "HEAD"});
}
var aLinkSuffix = '.html';
var pageName = document.location.pathname.split('/').pop().replaceAll('.html', '') || 'index';
pageName = decodeURI(pageName);
if (document.location.protocol === 'https:' && document.location.hostname !== '127.0.0.1'){
	aLinkSuffix = '';
}
function processImagePath(path) {
	return `${path.startsWith("§")?"":"Images/"}${path}`.replaceAll('§ModImage§', 'https://raw.githubusercontent.com/Tyfyter/Origins/master') + '.png';
}
class AsyncLock {
	constructor () {
		this.disable = () => {}
		this.promise = Promise.resolve()
	}

	enable () {
		this.promise = new Promise(resolve => this.disable = resolve)
	}
	static createLock() {
		let lock = new AsyncLock();
		lock.enable();
		return lock;
	}
}
let pageRequests = {};
let pageRequestLock = {};
async function getPageText(url) {
	if (pageRequests[url] === undefined) {
		pageRequests[url] ??= fetch(url);
	}
	if (pageRequests[url] instanceof Promise) {
		pageRequests[url] = await pageRequests[url];
	}
	if (pageRequestLock[url]) await pageRequestLock[url].promise;
	else pageRequestLock[url] = AsyncLock.createLock();
	if (pageRequests[url].text) {
		pageRequests[url] = await pageRequests[url].text();
		pageRequestLock[url].disable();
	}
	return await pageRequests[url];
}
var aStats = {};
async function getStats(name) {
	var value = await aStats[name];
	if(value === undefined){
		var v = await (aStats[name] = getPageText('stats/'+name + '.json'));
		value = aStats[name] = JSON.parse(v.startsWith('<!DOCTYPE html>') ? null : v);
	}
	return value;
}
getStats(pageName);

function createElementWithTextAndAttributes(tag, text) {
	let element = document.createElement(tag);
	element.innerHTML = text;
	for (let index = 2; index < arguments.length; index++) {
		element.setAttribute(...arguments[index]);
	}
	return element;
}

Object.defineProperty(HTMLElement.prototype, "createChild", {
    value: function createChild(tag, contents) {
		let element = document.createElement(tag);
		if (contents) element.innerHTML = contents;
		this.appendChild(element);
		for (let index = 2; index < arguments.length; index++) {
			element.setAttribute(...arguments[index]);
		}
		return element;
    },
    writable: true,
    configurable: true,
}); 

class AFMLImg extends HTMLElement {
	static observedAttributes = ["src", "alt"];
	child;
	constructor() {
		// Always call super first in constructor
		super();
		//this.textContent = "";
		this.classList.add('picturebox');
		this.child ??= document.createElement('img');
		this.child.setAttribute('style', 'width: inherit;');
		this.appendChild(this.child);
	}

	attributeChangedCallback(name, oldValue, newValue) {
		switch (name) {
			case 'src':
			this.child.setAttribute('src', newValue);
			break;
			case 'alt':
			if (this.attributes['alt']) this.child.setAttribute('alt', newValue);
			else this.child.removeAttribute('alt');
			break;
		}
		//console.log(name, oldValue, newValue);
	}
}
customElements.define("a-img", AFMLImg);
class AFMLLink extends HTMLAnchorElement { // can be created with document.createElement('a', {is: 'a-link' })
	static observedAttributes = ["href", "image"];
	image;
	constructor() {
		// Always call super first in constructor
		super();
		this.classList.add('link');
		let _notes = this.getElementsByTagName('note');
		let notes = [];
		for (let i = 0; i < _notes.length; i++) {
			const element = _notes[i];
			notes.push(element);
			element.parentNode.removeChild(element);
		}
		if (!this.hasAttribute('href')) {
			let targetPage = this.textContent.replaceAll(' ', '_');
			if (aliases[targetPage]) {
				targetPage = aliases[targetPage];
			}
			if (new URL(targetPage, document.baseURI).origin === new URL(document.location).origin) targetPage = targetPage.replaceAll('.html', '') + aLinkSuffix;
			this.setAttribute('href', targetPage);
		}
		if (new URL(this.getAttribute('href'), document.baseURI).href == document.location) {//self link
			this.classList.add('selflink');
			this.removeAttribute('href');
		}
		if (this.hasAttribute('notext')) {
			this.textContent = '';
		}
		this.image = document.createElement('img');
		this.insertBefore(this.image, this.firstChild);
		if (notes.length) {
			let noteContainer = document.createElement('span');
			noteContainer.classList.add('linkandnote');
			let index = 0;
			while (this.childNodes.length > index) {
				const element = this.childNodes[index];
				if (element.nodeName === 'IMG') {
					index++;
					continue;
				}
				noteContainer.appendChild(element);
			}
			for (let i = 0; i < notes.length; i++) {
				notes[i].classList.add('linknote');
				noteContainer.appendChild(notes[i]);
			}
			this.appendChild(noteContainer);
		}
	}
	attributeChangedCallback(name, oldValue, newValue) {
		switch (name) {
			case 'href': {
				requestHead(newValue).then((v) => {
					if (v.status == 404) this.classList.add('redlink');
					else this.classList.remove('redlink');
				});
				break;
			}
			case 'image': {
				this.setImage(newValue);
				break;
			}
		}
	}
	setImage(path) {
		if (path === '$fromStats') {
			path = this.href.replaceAll('.html', '').split('/');
			path = path[path.length - 1];
			getStats(path).then((v) => {
				this.setImage(v.Image);
			});
		} else {
			this.image.src = processImagePath(path);
		}
	}
}
customElements.define("a-link", AFMLLink, { extends: "a" });

class AFMLSnippet extends HTMLElement { // can be created with document.createElement('a', {is: 'a-link' })
	static observedAttributes = ["href", "pluck"];
	button;
	content;
	constructor() {
		// Always call super first in constructor
		super();
		let text = this.textContent;
		this.textContent = "";
		this.button = document.createElement('a');
		this.button.classList.add('snippetButton');
		this.button.textContent = text;
		this.appendChild(this.button);

		this.content = document.createElement('span');
		this.content.classList.add('snippetContent');
		this.appendChild(this.content);
		if (!this.hasAttribute('href')) {
			this.setAttribute('open', '');
			this.content.textContent = "snippet is missing href attribute";
			return;
		}
		if (this.hasAttribute('hidden')) {
			this.setAttribute('open', '');
		}
		this.button.href = 'javascript:void(0)';
		this.button.onclick = () => {
			if (this.hasAttribute('open')) {
				this.removeAttribute('open');
			} else {
				this.setAttribute('open', '');
			}
		}
	}
	attributeChangedCallback(name, oldValue, newValue) {
		let contentID = 'snippetContent' + this.getAttribute('href') + this.getAttribute('pluck');
		if (this.content.id === contentID) return;
		this.content.id = contentID;
		getPageText(this.getAttribute('href')).then(async (v) => {
			this.content.innerHTML = v;
			let pluckSelector = this.getAttribute('pluck');
			//console.debug('pluck: ', pluckSelector, ' from ', content.children);
			if (pluckSelector) {
				let children = this.content.querySelectorAll(pluckSelector);
				this.content.innerHTML = "";
				for (var i = 0; i < children.length; i++) {
					this.content.appendChild(children[i]);
				}
			}
			await parseAFML(false, this.content.id);
		});
	}
}
customElements.define("a-snippet", AFMLSnippet);

class AFMLCoins extends HTMLElement {
	constructor() {
		// Always call super first in constructor
		super();
		this.classList.add('coins');
		let count = parseInt(this.textContent);
		this.textContent = '';
		this.createCoin('platinum', count / (100 * 100 * 100));
		this.createCoin('gold', (count / (100 * 100)) % 100);
		this.createCoin('silver', (count / (100)) % 100);
		this.createCoin('copper', count % 100);
	}
	createCoin(type, count) {
		count = Math.floor(count);
		if (count == 0) return;
		this.createChild('span', count, ['class', type]);
	}
}
customElements.define("a-coins", AFMLCoins);

class AFMLCoin extends HTMLElement {
	constructor() {
		// Always call super first in constructor
		super();
		this.classList.add('coins');
		let type = this.textContent.trim().toLowerCase();
		this.textContent = '';
		this.createChild('span', '', ['class', type]);
	}
}
customElements.define("a-coin", AFMLCoin);

class AFMLToolStats extends HTMLElement {
	static observedAttributes = ["pick", "hammer", "axe"];
	constructor() {
		// Always call super first in constructor
		super();
		this.classList.add('toolstats');
	}
	attributeChangedCallback(name, oldValue, newValue) {
		this.textContent = '';
		this.createTool(this.getAttribute('pick'), 'Pickaxe power', 'https://terraria.wiki.gg/images/thumb/0/05/Pickaxe_icon.png/16px-Pickaxe_icon.png');
		this.createTool(this.getAttribute('hammer'), 'Hammer power', 'https://terraria.wiki.gg/images/thumb/0/05/Pickaxe_icon.png/16px-Pickaxe_icon.png');
		this.createTool(this.getAttribute('axe'), 'Axe power', 'Images/Axe_Icon.png');
	}
	createTool(amount, name, src) {
		if (!amount) return;
		let container = this.createChild('span', amount + "%", ['class', 'toolstat']);
		container.createChild('img', '',
			['title', name],
			['src', src],
			['decoding', "async"],
			['loading', "lazy"]
		);
	}
}
customElements.define("a-tool", AFMLToolStats);

class AFMLRecipes extends HTMLElement {
	constructor() {
		// Always call super first in constructor
		super();
		if (!this.innerHTML.startsWith('{') && !this.innerHTML.startsWith('[')) return;
		//console.log('['+this.textContent+']');
		let sections = eval('['+this.innerHTML+']');
		this.textContent = '';
		let table = this.createChild('table', '', ['class', 'recipetable'], ['cellspacing', '0']);
		let head = table.createChild('thead');
		let row = head.createChild('tr');
		row.createChild('th', 'Result');
		row.createChild('th', 'Ingredients', ['class', 'middle']);
		row.createChild('th').createChild('a', 'Crafting Station', ['href', 'https://terraria.wiki.gg/wiki/Crafting_stations']);

		let body = table.createChild('tbody');
		for(let j = 0; j < sections.length; j++){
			console.log(sections[j]);
			this.processRecipeBlock(sections[j], body);
		}
	}
	processRecipeBlock(data, body){
		let stations = '<a href="https://terraria.wiki.gg/wiki/By_Hand">By Hand</a>';
		if(data.stations){
			console.log(data.stations);
			if(Array.isArray(data.stations)){
				stations = '';
				for(var j = 0; j < data.stations.length; j++){
					if(j>0){
						stations += '<br><div class="or">or</div><br>';
					}
					stations += data.stations[j];
				}
			}else{
				stations = data.stations;
			}
		}
		for(var i = 0; i < data.items.length; i++){
			let row = document.createElement('tr');
			row.createChild('td', data.items[i].result);
			let ingredientList = row.createChild('td', '', ['class', 'middle']);
			for(var j = 0; j < data.items[i].ingredients.length; j++){
				if(j>0){
					ingredientList.appendChild(document.createElement('br'));
				}
				this.parse(data.items[i].ingredients[j], ingredientList);
			}
			if(i <= 0) {
				row.createChild('td', stations, ['rowspan', data.items.length]);
			}
			body.append(row);
		}
	}
	parse(text, parent) {
		let span = document.createElement('span');
		span.innerHTML = text;
		while (span.childNodes.length) {
			parent.appendChild(span.childNodes[0]);
		}
		if (span.parentElement) span.parentElement.removeChild(span);
	}
}
customElements.define("a-recipes", AFMLRecipes);

class AFMLStat extends HTMLElement {
	constructor() {
		// Always call super first in constructor
		super();
		this.classList.add('stat');
		let stat = this.textContent.replace(' ', '_').split('.');
		getStats(stat[0]).then((v) => {
			for(var i = 1; i < stat.length; i++){
				v = v[stat[i]];
			}
			this.innerHTML = v;
		});
	}
}
customElements.define("a-stat", AFMLStat);

class AFMLStatBlock extends HTMLElement {
	static observedAttributes = ["src"];
	constructor() {
		// Always call super first in constructor
		super();
		this.classList.add('ontab0');
		if (!this.hasAttribute('src')) {
			let value = new Function(`return ${this.innerHTML};`)();
			this.textContent = '';
			for (let i = 0; i < value.length; i++) {
				this.addContents(value[i]);
			}
		}
	}
	attributeChangedCallback(name, oldValue, newValue) {
		getStats(newValue.replace(' ', '_')).then((v) => { this.doAutoStats(v) });
	}
	doAutoStats(stats) {
		this.textContent = '';
		var values = [];
		var statistics = {header:"Statistics", items:[]};
		function labeled(value, text, href) {
			statistics.items.push({label:href ? `<a is="a-link" ${href ? 'href=' + href: ''}>${text}</a>` : text, value: value});
		}
		function valueOrValues(value, text, href){
			let obj = {label:href ? `<a is="a-link" ${href ? 'href=' + href: ''}>${text}</a>` : text};
			if (Array.isArray(value)) {
				obj.values = value;
			} else {
				obj.value = value;
			}
			statistics.items.push(obj);
		}
    	if(stats.Image){
			var widthStr = stats.SpriteWidth ? `, spriteWidth:${stats.SpriteWidth}`: false;
        	values.push({
				header: stats.Name || this.getAttribute('src').replaceAll('_',' '),
				items:[{image: processImagePath(stats.Image), spriteWidth:widthStr}]
			});
    	} else if(stats.Images){
			var widthStr = stats.SpriteWidth ? `, spriteWidth:${stats.SpriteWidth}`: false;
			var images = [];
			let is2D = Array.isArray(stats.Images[0]);
			for (let i = 0; i < stats.Images.length; i++) {
				const image = stats.Images[i];
				if (is2D) {
					images[i] = [];
					for (let j = 0; j < image.length; j++) {
						images[i][j] = processImagePath(image[j]);
					}
				} else {
					images[i] = processImagePath(image);
				}
			}
        	values.push({
				header: stats.Name || this.getAttribute('src').replaceAll('_',' '),
				items: [{images: images}]
			});
    	}
		if (stats.Types.includes("Item")) {
			var setSuffix = stats.Types.includes("ArmorSet") ? '(set)' : '';
			if (stats.PickPower || stats.HammerPower || stats.AxePower) {
				statistics.items.push({
					literalvalue: `<a-tool ${stats.PickPower ? 'pick=' + stats.PickPower : ''} ${stats.HammerPower ? 'hammer=' + stats.HammerPower : ''} ${stats.AxePower ? 'axe=' + stats.AxePower : ''}></a-tool>`
				});
			}
			if (stats.FishPower) labeled(stats.FishPower+'%', 'Fishing power', 'https://terraria.wiki.gg/wiki/Fishing');
			if (stats.BaitPower) labeled(stats.BaitPower+'%', 'Bait power', 'https://terraria.wiki.gg/wiki/Bait');
			if (stats.PickReq || stats.HammerReq) {
				statistics.items.push({
					literalvalue: `<a-tool ${stats.PickReq ? 'pick=' + stats.PickReq : ''} ${stats.HammerReq ? 'hammer=' + stats.HammerReq : ''}></a-tool>`
				});
			}
			if(stats.LightIntensity|| stats.LightColor){
				var torchIcon = '';
				var torchIntensity = stats.LightIntensity || '';
				if (stats.LightColor) {
					torchIcon = `<img src="Images/Torch_Icon.png" style="mix-blend-mode: screen;background-color: ${
						`rgb(${(stats.LightColor[0]) * 255}, ${(stats.LightColor[1]) * 255}, ${(stats.LightColor[2]) * 255})`
					};">`;
				}
				statistics.items.push({
					literalvalue: torchIcon + torchIntensity
				});
			}
			if (stats.PlacementSize) labeled(`yes (${stats.PlacementSize[0]}x${stats.PlacementSize[1]})`, 'Placeable', 'https://terraria.wiki.gg/wiki/Placement');
			if (stats.Defense) {
				labeled(stats.Defense, stats.Defense + setSuffix);
				if (stats.Tooltip) valueOrValues(stats.Tooltip, 'Tooltip', 'https://terraria.wiki.gg/wiki/Tooltips');
			}
			if (stats.SetBonus) labeled(stats.SetBonus, 'Set Bonus', 'https://terraria.wiki.gg/wiki/Armor');
			if (stats.ArmorSlot) labeled(stats.armorSlot, 'Armor Slot');
			if (stats.Damage) labeled(stats.Damage + (stats.DamageClass ? ` (${stats.DamageClass})`: ''), 'Damage');
			if (stats.ArmorPenetration) labeled(stats.ArmorPenetration, 'Armor Penetration', 'https://terraria.wiki.gg/wiki/Defense#Armor_penetration');
			if (stats.Knockback) labeled(stats.Knockback, 'Knockback', 'https://terraria.wiki.gg/wiki/Knockback');
			if (stats.ManaCost) labeled(stats.ManaCost, 'Mana cost', 'https://terraria.wiki.gg/wiki/Mana');
			if (stats.HealLife) labeled(stats.HealLife, 'Heals Health', 'https://terraria.wiki.gg/wiki/Health');
			if (stats.HealMana) labeled(stats.HealMana, 'Heals mana', 'https://terraria.wiki.gg/wiki/Mana');
			if (stats.Crit) labeled(stats.Crit, 'Critical chance', 'https://terraria.wiki.gg/wiki/Critical_hit');
			if (stats.UseTime) labeled(`${stats.UseTime} (${GetSpeedName(stats.UseTime)})`, 'Use time', 'https://terraria.wiki.gg/wiki/Use_Time');
			if (stats.Velocity) labeled(stats.Velocity, 'Velocity', 'https://terraria.wiki.gg/wiki/Velocity');
			if (stats.Tooltip && !stats.Defense) {
				if (stats.Tooltip) valueOrValues(stats.Tooltip, 'Tooltip', 'https://terraria.wiki.gg/wiki/Tooltips');
			}
			if (stats.Rarity) labeled(`<a is="a-link" href="https://terraria.wiki.gg/wiki/Rarity" image="Rare${stats.Rarity}" notext>${stats.Rarity}</a>`, 'Rarity', 'https://terraria.wiki.gg/wiki/Rarity');
			if (stats.Buy) labeled(`<a-coins>${stats.Buy}</a-coins>`, 'Buy', 'https://terraria.wiki.gg/wiki/Value');
			if (stats.Sell) labeled(`<a-coins>${stats.Sell}</a-coins>`, 'Sell', 'https://terraria.wiki.gg/wiki/Value');
			if (stats.Research) labeled(`<abbr class="journey" title="Journey Mode">${stats.Research} required</abbr>`, 'Research', 'https://terraria.wiki.gg/wiki/Journey_Mode#Research');
		}
		var normalTabClass = (stats.Expert || stats.Master) ? 'onlytab0' : false;
		var _expertClass = 'onlytab1';
		var _masterClass = stats.Expert ? 'onlytab2' : 'onlytab1';
		const getTabClass = (val) => {
			return (stats.Expert && stats.Expert[val]) || (stats.Master && stats.Master[val])? normalTabClass : false;
		};
		function addStat(area, label, propertyName, dataProcessor = null){
			let valueClass = getTabClass(propertyName);
			let value = {label:label};
			if (valueClass) value.class = valueClass;
			let propertyValue = stats[propertyName];
			if (propertyValue) {
				if (dataProcessor) propertyValue = dataProcessor(propertyValue);
				value[`value${Array.isArray(propertyValue)?'s':''}`] = propertyValue;
				area.items.push(value);
			}
			if (stats.Expert) {
				value = {label:label, class:_expertClass, valueClass:'expert'};
				propertyValue = stats.Expert[propertyName];
				if (propertyValue) {
					if (dataProcessor) propertyValue = dataProcessor(propertyValue);
					value[`value${Array.isArray(propertyValue)?'s':''}`] = propertyValue;
					area.items.push(value);
				}
			}
			if (stats.Master) {
				value = {label:label, class:_masterClass, valueClass:'master'};
				propertyValue = stats.Master[propertyName];
				if (propertyValue) {
					if (dataProcessor) propertyValue = dataProcessor(propertyValue);
					value[`value${Array.isArray(propertyValue)?'s':''}`] = propertyValue;
					area.items.push(value);
				}
			}
		}
		if (normalTabClass) {
			statistics.tabs = ['Normal'];
			if (stats.Expert) statistics.tabs.push({toString:()=>'Expert', class:'expert'});
			if (stats.Master) statistics.tabs.push({toString:()=>'Master', class:'master'});
		}
		if(stats.Types.includes("NPC")){
			addStat(statistics, '<a is="a-link" href="https://terraria.wiki.gg/wiki/Biome">Environment</a>', 'Biome');
			addStat(statistics, '<a is="a-link" href="https://terraria.wiki.gg/wiki/AI">AI Style</a>', 'AIStyle');
			addStat(statistics, 'Damage', 'Damage');
			addStat(statistics, 'Max Life', 'MaxLife');
			addStat(statistics, '<a is="a-link" href="https://terraria.wiki.gg/wiki/Defense">Defense</a>', 'Defense');
			addStat(statistics, '<a is="a-link" href="https://terraria.wiki.gg/wiki/Knockback">Knockback</a>', 'KBResist');
			addStat(statistics, 'Immune to', 'Immunities');
		}

		if (statistics.items.length) values.push(statistics);
		if (stats.Buffs) {
			var buffs = {header: `Grants buff${stats.Buffs.length > 1 ? 's' : ''}`, items:[]};
			for (let buffIndex = 0; buffIndex < stats.Buffs.length; buffIndex++) {
				const buff = stats.Buffs[buffIndex];
				buffs.items.push({label:'Buff', value:`<a is="a-link"${buff.Image ? (' image="' + buff.Image + '"') : ''}>${buff.Name}</a>`});
				if(buff.Tooltip){
					buffs.items.push({label:'Buff tooltip',value:buff.Tooltip});
				}
				if(buff.Chance){
					buffs.items.push({label:'Chance',value:buff.Chance});
				}
				if(buff.Duration){
					buffs.items.push({label:'Duration',value:buff.Duration});
				}
			}
			if (buffs.items.length > 0) values.push(buffs);
		}
		if (stats.Debuffs) {
			var buffs = {header: `Inflicts debuff${stats.Debuffs.length > 1 ? 's' : ''}`, items:[]};
			for (let buffIndex = 0; buffIndex < stats.Debuffs.length; buffIndex++) {
				const buff = stats.Debuffs[buffIndex];
				buffs.items.push({label:'Debuff', value:`<a is="a-link"${buff.Image ? (' image="' + buff.Image + '"') : ''}>${buff.Name}</a>`});
				if(buff.Tooltip){
					buffs.items.push({label:'Debuff tooltip',value:buff.Tooltip});
				}
				if(buff.Chance){
					buffs.items.push({label:'Chance',value:buff.Chance});
				}
				if(buff.Duration){
					buffs.items.push({label:'Duration',value:buff.Duration});
				}
			}
			if (buffs.items.length > 0) values.push(buffs);
		}
		if(stats.Drops || stats.Coins) {
			var loot = {header:"Drops", items:[]};
			addStat(loot, '<a is="a-link" href="https://terraria.wiki.gg/wiki/NPC_drops#Coin_drops">Coins</a>', 'Coins', (v) => `<a-coins>${v}</a-coins>`);
			addStat(loot, 'Items', 'Drops', (v) => {
				let stat = '';
				for (let i = 0; i < v.length; i++) {
					const item = v[i];
					if (item.Name) {
						stat += `<a-drop item='${item.Name}' amount='${item.Amount || ''}' chance='${item.Chance || ''}'></a-drop>`;
					} else {
						stat += item;
					}
				}
				return stat;
			});
			values.push(loot);
		}
		for (let i = 0; i < values.length; i++) {
			this.addContents(values[i]);
		}
	}
	
	addContents(data) {
		if (data.header) {
			let header = this.createChild('div', '', ['class', 'header']);
			header.createChild('span', '', ['class', "padding"], ['style', "padding-left: 7.5px;"]);
			header.createChild('span', data.header, ['class', "text"]);
			header.createChild('span', '', ['class', "padding"], ['style', "flex-grow: 1;"]);
		}
		if (data.tabs && data.tabs.length > 1) {
			let container = this.createChild('div', '', ['class', 'tabnames']);
			for(var i = 0; i < data.tabs.length; i++){
				container.createChild('span', data.tabs[i].name || data.tabs[i], ['class', `tabname ${data.tabs[i].class || ''}`], ['onClick', `selectTab(event.srcElement,${i})`]);
			}
		}
		if(data.items){
			for(var i = 0; i < data.items.length; i++){
				const item = data.items[i];
				if (item.images) {
					let container = this.createChild('div', '', ['class', 'statimagecontainer']);
					const is2D = Array.isArray(item.images[0]);
					for (let j = 0; j < data.items[i].images.length; j++) {
						const element = data.items[i].images[j];
						if (is2D) {
							if (j > 0) {
								container.createChild('div', '', ['class', 'statimagedivider']);
							}
							let container2 = container.createChild('div', '', ['class', 'statimagecontainer']);
							for (let k = 0; k < element.length; k++) {
								this.createImage(element[k], item.spriteWidth && item.spriteWidth[j][k], container2);
							}
						} else {
							this.createImage(element, item.spriteWidth && item.spriteWidth[j], container);
						}
					}
				} else if(item.image) {
					this.createImage(item.image, item.spriteWidth, this);
				} else {
					let element = this.createChild('div', item.literalvalue || (item.label && `${item.label}: `));
					element.className = 'stat ' + (item.class || '');
					if(item.value) {
						let stat = element.createChild('span', item.value);
						if (item.valueClass) stat.classList = item.valueClass;
					} else if(item.values) {
						let stat = element.createChild('span', item.values.join('<br>'));
						stat.className = 'statvalues ' + (item.valueClass || '');
					}
				}
			}
		}
	}
	createImage(src, width, container) {
		let image = container.createChild('img', '', ['src', src]);
		if (width) image.style.maxWidth = width + 'px';
		if (src.endsWith && src.endsWith('_Female.png')) image.title = 'female sprite';
	}
}
customElements.define("a-statblock", AFMLStatBlock);

class AFMLDrop extends HTMLElement {
	static observedAttributes = ["item", "amount", "chance", "conditions"];
	constructor() {
		// Always call super first in constructor
		super();
	}
	lastAttr;
	attributeChangedCallback(name, oldValue, newValue) {
		let attr = '';
		for (let i = 0; i < this.attributes.length; i++) {
			attr += `${this.attributes[i].name} ${this.attributes[i].value}`;
		}
		if (attr === this.lastAttr) return;
		this.lastAttr = attr;
		getStats(this.getAttribute('item').replaceAll(' ', '_')).then((stats) => {
			let linkTarget = this.getAttribute('linkOverride') || (this.getAttribute('item').replaceAll(' ', '_') + aLinkSuffix);

			let image = stats && (stats.Image || (stats.Images && stats.Images[0]));
			if (this.hasAttribute('imageOverride')) image = this.getAttribute('imageOverride'); 

			let textContent = (stats && stats.Name) || this.getAttribute('item').replaceAll('_', ' ');
			//console.log(linkTarget, image, textContent);
			let text = `<a is="a-link" href="${linkTarget}" ${image ? `image="${image}"` : ''}>${textContent}</a> - `;
			if (this.getAttribute('amount')) text += `(${this.getAttribute('amount')}) `;
			text += this.getAttribute('chance') || '100%';
			//console.log(text);
			this.innerHTML = text;
			if (stats && stats.Drops) {
				for (let i = 0; i < stats.Drops.length; i++) {
					const item = stats.Drops[i];
					if (item.Name) {
						let extraAttributes = [];
						if (item.hasOwnProperty('LinkOverride')) extraAttributes.push(['linkOverride', item.LinkOverride]);
						if (item.hasOwnProperty('ImageOverride')) extraAttributes.push(['imageOverride', item.ImageOverride]);
						this.createChild('a-drop', '', 
							['item', item.Name],
							['amount', item.Amount || ''],
							['chance', item.Chance || ''],
							...extraAttributes
						);
					} else {
						this.createChild('div', item);
					}
				}
			}
		});
	}
}
customElements.define("a-drop", AFMLDrop);