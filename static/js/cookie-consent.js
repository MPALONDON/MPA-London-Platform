document.addEventListener('DOMContentLoaded', function() {
    const cookieBanner = document.getElementById('cookie-consent-banner');
    const acceptButton = document.getElementById('accept-cookies');
    const rejectButton = document.getElementById('reject-cookies');
    const cookiePreferencesButton = document.getElementById('cookie-preferences');

    // Cookie categories
    const COOKIE_CATEGORIES = {
        necessary: {
            name: 'necessary',
            enabled: true, // Always enabled
            description: 'Essential for the website to function properly'
        },
        analytics: {
            name: 'analytics',
            enabled: false,
            description: 'Help us understand how visitors interact with our website'
        },
        marketing: {
            name: 'marketing',
            enabled: false,
            description: 'Used to track visitors across websites for advertising'
        }
    };

    // Function to set a cookie
    function setCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
    }

    // Function to get a cookie
    function getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    // Function to delete a cookie
    function deleteCookie(name) {
        document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
    }

    // Function to save cookie preferences
    function saveCookiePreferences() {
        const preferences = {
            necessary: true, // Always true
            analytics: COOKIE_CATEGORIES.analytics.enabled,
            marketing: COOKIE_CATEGORIES.marketing.enabled
        };
        setCookie('cookie_preferences', JSON.stringify(preferences), 365);
    }

    // Function to load cookie preferences
    function loadCookiePreferences() {
        const preferences = getCookie('cookie_preferences');
        if (preferences) {
            try {
                const parsed = JSON.parse(preferences);
                COOKIE_CATEGORIES.analytics.enabled = parsed.analytics;
                COOKIE_CATEGORIES.marketing.enabled = parsed.marketing;
            } catch (e) {
                console.error('Error parsing cookie preferences:', e);
            }
        }
    }

    // Function to handle analytics cookies
    function handleAnalyticsCookies(enable) {
        if (enable) {
            // Enable Google Analytics
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-PSV9FVXY8K');
            setCookie('analytics_enabled', 'true', 365);
        } else {
            // Disable Google Analytics
            window['ga-disable-G-PSV9FVXY8K'] = true;
            deleteCookie('analytics_enabled');
        }
    }

    // Function to handle marketing cookies
    function handleMarketingCookies(enable) {
        if (enable) {
            // Enable Facebook Pixel
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', 'YOUR_FACEBOOK_PIXEL_ID'); // Replace with your Facebook Pixel ID
            fbq('track', 'PageView');

            // Enable TikTok Pixel
            !function (w, d, t) {
                w.TiktokAnalyticsObject=t;
                var ttq=w[t]=w[t]||[];
                ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
                ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
                for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
                ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
                ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
                ttq.load('YOUR_TIKTOK_PIXEL_ID'); // Replace with your TikTok Pixel ID
                ttq.page();
            }(window, document, 'ttq');

            setCookie('marketing_enabled', 'true', 365);
        } else {
            // Disable marketing tools
            deleteCookie('marketing_enabled');
            // Clear any existing marketing cookies
            const marketingCookies = ['_fbp', '_fb', '_tt_', '_tt_enable_cookie']; // Added TikTok cookies
            marketingCookies.forEach(cookie => deleteCookie(cookie));
        }
    }

    // Function to show cookie preferences modal
    function showCookiePreferences() {
        const modal = document.getElementById('cookiePreferencesModal');
        if (modal) {
            const analyticsToggle = modal.querySelector('#analytics-toggle');
            const marketingToggle = modal.querySelector('#marketing-toggle');
            
            // Set initial states
            analyticsToggle.checked = COOKIE_CATEGORIES.analytics.enabled;
            marketingToggle.checked = COOKIE_CATEGORIES.marketing.enabled;

            // Show modal
            const modalInstance = new bootstrap.Modal(modal);
            modalInstance.show();

            // Handle save button
            const saveButton = modal.querySelector('#save-preferences');
            saveButton.addEventListener('click', function() {
                COOKIE_CATEGORIES.analytics.enabled = analyticsToggle.checked;
                COOKIE_CATEGORIES.marketing.enabled = marketingToggle.checked;

                handleAnalyticsCookies(COOKIE_CATEGORIES.analytics.enabled);
                handleMarketingCookies(COOKIE_CATEGORIES.marketing.enabled);
                saveCookiePreferences();

                modalInstance.hide();
            });
        }
    }

    // Check if user has already made a choice
    const cookieConsent = getCookie('cookie_consent');
    if (!cookieConsent) {
        cookieBanner.style.display = 'block';
    } else {
        // Apply previous consent settings
        loadCookiePreferences();
        handleAnalyticsCookies(COOKIE_CATEGORIES.analytics.enabled);
        handleMarketingCookies(COOKIE_CATEGORIES.marketing.enabled);
    }

    // Handle accept button click
    acceptButton.addEventListener('click', function() {
        setCookie('cookie_consent', 'accepted', 365);
        COOKIE_CATEGORIES.analytics.enabled = true;
        COOKIE_CATEGORIES.marketing.enabled = true;
        handleAnalyticsCookies(true);
        handleMarketingCookies(true);
        saveCookiePreferences();
        cookieBanner.style.display = 'none';
    });

    // Handle reject button click
    rejectButton.addEventListener('click', function() {
        setCookie('cookie_consent', 'rejected', 365);
        COOKIE_CATEGORIES.analytics.enabled = false;
        COOKIE_CATEGORIES.marketing.enabled = false;
        handleAnalyticsCookies(false);
        handleMarketingCookies(false);
        saveCookiePreferences();
        cookieBanner.style.display = 'none';
    });

    // Handle cookie preferences button click
    if (cookiePreferencesButton) {
        cookiePreferencesButton.addEventListener('click', function(e) {
            e.preventDefault();
            showCookiePreferences();
        });
    }
}); 