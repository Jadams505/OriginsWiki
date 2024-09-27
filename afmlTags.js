class AFMLImg extends HTMLElement {
    static observedAttributes = ["src", "alt"];
    child;
    constructor() {
        // Always call super first in constructor
        super();
        this.textContent = "";
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
