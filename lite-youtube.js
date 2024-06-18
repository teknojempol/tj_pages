export class LiteYTEmbed extends HTMLElement {
    constructor() {
        super();
        this.isIframeLoaded = false;
        this.setupDom();
    }

    static get observedAttributes() {
        return ['videoid', 'playlistid', 'videotitle', 'videoPlay'];
    }

    connectedCallback() {
        this.addEventListener('pointerover', LiteYTEmbed.warmConnections, { once: true });
        this.addEventListener('click', () => this.addIframe());
    }

    getAttributeValue(attr, defaultValue = '') {
        return encodeURIComponent(this.getAttribute(attr) || defaultValue);
    }

    get videoId() { return this.getAttributeValue('videoid'); }
    set videoId(id) { this.setAttribute('videoid', id); }

    get playlistId() { return this.getAttributeValue('playlistid'); }
    set playlistId(id) { this.setAttribute('playlistid', id); }

    get videoTitle() { return this.getAttribute('videotitle') || 'Video'; }
    set videoTitle(title) { this.setAttribute('videotitle', title); }

    get videoPlay() { return this.getAttribute('videoPlay') || 'Play'; }
    set videoPlay(name) { this.setAttribute('videoPlay', name); }

    get videoStartAt() { return this.getAttribute('videoStartAt') || '0'; }

    get autoLoad() { return this.hasAttribute('autoload'); }
    get noCookie() { return this.hasAttribute('nocookie'); }

    get posterQuality() { return this.getAttribute('posterquality') || 'hqdefault'; }
    get posterLoading() { return this.getAttribute('posterloading') || 'lazy'; }

    get params() {
        return `start=${this.videoStartAt}&${this.getAttribute('params')}`;
    }
    set params(opts) {
        this.setAttribute('params', opts);
    }

    setupDom() {
        const shadowDom = this.attachShadow({ mode: 'open' });
        const nonce = window.liteYouTubeNonce ? `nonce="${window.liteYouTubeNonce}"` : '';

        shadowDom.innerHTML = `
            <style ${nonce}>
                :host { contain: content; display: block; position: relative; width: 100%; padding-bottom: calc(100% / (16 / 9)); }
                @media (max-width: 40em) { :host([short]) { padding-bottom: calc(100% / (9 / 16)); } }
                #frame, #placeholder, iframe { position: absolute; width: 100%; height: 100%; left: 0; }
                #frame { cursor: pointer; }
                #placeholder { object-fit: cover; }
                #frame::before { content: ''; display: block; position: absolute; top: 0; background-image: linear-gradient(180deg, #111 -20%, transparent 90%); height: 60px; width: 100%; z-index: 1; }
                #playButton { width: 68px; height: 48px; background-color: transparent; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 68 48"><path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="red"/><path d="M45 24 27 14v20" fill="white"/></svg>'); z-index: 1; border: 0; border-radius: inherit; }
                #playButton:before { content: ''; border-style: solid; border-width: 11px 0 11px 19px; border-color: transparent transparent transparent #fff; }
                #playButton, #playButton:before { position: absolute; top: 50%; left: 50%; transform: translate3d(-50%, -50%, 0); cursor: inherit; }
                .activated { cursor: unset; }
                #frame.activated::before, #frame.activated > #playButton { display: none; }
            </style>
            <div id="frame">
                <img id="placeholder" referrerpolicy="origin" loading="lazy">
                <button id="playButton"></button>
            </div>
        `;

        this.domRefFrame = shadowDom.querySelector('#frame');
        this.domRefImg = shadowDom.querySelector('#placeholder');
        this.domRefPlayButton = shadowDom.querySelector('#playButton');
    }

    setupComponent() {
        this.initImagePlaceholder();
        const ariaLabel = `${this.videoPlay}: ${this.videoTitle}`;
        this.domRefPlayButton.setAttribute('aria-label', ariaLabel);
        this.setAttribute('title', ariaLabel);
        if (this.autoLoad || this.isYouTubeShort()) {
            this.initIntersectionObserver();
        }
    }

    attributeChangedCallback(name, oldVal, newVal) {
        if (oldVal !== newVal) {
            this.setupComponent();
            if (this.domRefFrame.classList.contains('activated')) {
                this.domRefFrame.classList.remove('activated');
                this.shadowRoot.querySelector('iframe').remove();
                this.isIframeLoaded = false;
            }
        }
    }

    addIframe(isIntersectionObserver = false) {
        if (!this.isIframeLoaded) {
            let autoplay = isIntersectionObserver ? 0 : 1;
            const wantsNoCookie = this.noCookie ? '-nocookie' : '';
            let embedTarget = this.playlistId ? `?listType=playlist&list=${this.playlistId}&` : `${this.videoId}?`;

            if (this.isYouTubeShort()) {
                this.params = `loop=1&mute=1&modestbranding=1&playsinline=1&rel=0&enablejsapi=1&playlist=${this.videoId}`;
                autoplay = 1;
            }

            const iframeHTML = `
<iframe frameborder="0" title="${this.videoTitle}"
  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen
  src="https://www.youtube${wantsNoCookie}.com/embed/${embedTarget}autoplay=${autoplay}&${this.params}"
></iframe>`;
            this.domRefFrame.insertAdjacentHTML('beforeend', iframeHTML);
            this.domRefFrame.classList.add('activated');
            this.isIframeLoaded = true;
            this.attemptShortAutoPlay();
            this.dispatchEvent(new CustomEvent('liteYoutubeIframeLoaded', {
                detail: { videoId: this.videoId },
                bubbles: true,
                cancelable: true,
            }));
        }
    }

    initImagePlaceholder() {
        const posterUrlWebp = `https://i3.ytimg.com/vi_webp/${this.videoId}/${this.posterQuality}.webp`;
        this.domRefImg.loading = this.posterLoading;
        this.domRefImg.src = posterUrlWebp;
        const altText = `${this.videoPlay}: ${this.videoTitle}`;
        this.domRefImg.setAttribute('aria-label', altText);
        this.domRefImg.setAttribute('alt', altText);
    }

    initIntersectionObserver() {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isIframeLoaded) {
                    LiteYTEmbed.warmConnections();
                    this.addIframe(true);
                    observer.unobserve(this);
                }
            });
        }, { root: null, rootMargin: '0px', threshold: 0 });
        observer.observe(this);
    }

    attemptShortAutoPlay() {
        if (this.isYouTubeShort()) {
            setTimeout(() => {
                this.shadowRoot.querySelector('iframe')?.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
            }, 2000);
        }
    }

    isYouTubeShort() {
        return this.getAttribute('short') === '' && window.matchMedia('(max-width: 40em)').matches;
    }

    static addPrefetch(kind, url) {
        const linkElem = document.createElement('link');
        linkElem.rel = kind;
        linkElem.href = url;
        linkElem.crossOrigin = 'true';
        document.head.append(linkElem);
    }

    static warmConnections() {
        if (LiteYTEmbed.isPreconnected || window.liteYouTubeIsPreconnected) return;
        const preconnectUrls = [
            'https://i.ytimg.com/',
            'https://s.ytimg.com',
            'https://www.youtube.com',
            'https://www.google.com',
            'https://googleads.g.doubleclick.net',
            'https://static.doubleclick.net'
        ];
        preconnectUrls.forEach(url => LiteYTEmbed.addPrefetch('preconnect', url));
        LiteYTEmbed.isPreconnected = true;
        window.liteYouTubeIsPreconnected = true;
    }
}

LiteYTEmbed.isPreconnected = false;
customElements.define('lite-youtube', LiteYTEmbed);
//# sourceMappingURL=lite-youtube.js.map
