/* ------------------------------------------------------------------------ */
/* Load mailer.config.json                                                  */
/* configure selectors, styles, behavior in `app/config/mailer.config.json` */
/* ------------------------------------------------------------------------ */


const CONFIG = (() => {
    const JSON_PATH = "/app/config/mailer.config.json";
    const xhr = new XMLHttpRequest();
    xhr.open("GET", JSON_PATH, false);
    xhr.send(null);

    if (!(xhr.status >= 200 && xhr.status < 300)) {
        throw new Error(`Failed to load config file: ${JSON_PATH} (${xhr.status})`);
    }

    const j = JSON.parse(xhr.responseText);

    return {
        selectors: j.selectors,
        styles: j.styles,
        constraints: {
            minMessageLength: j.validation.minMessageLength,
            emailRegex: new RegExp(j.validation.emailRegex),
            phoneRegex: new RegExp(j.validation.phoneRegex),
            urlRegex: new RegExp(j.validation.urlRegex, "i"),
            requirePhone: !!j.validation.requirePhone,   
            blockUrls: !!j.validation.blockUrls,         
        },
        submitUrl: j.network.submitUrl,
        submitHeaders: j.network.submitHeaders,
        messages: j.messages || undefined,
    };
})();
 

/* ------------------------------------------------------------------------ */
/* DOM util + selectors                                                     */
/* ------------------------------------------------------------------------ */


const $$  = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const $1  = (sel, root = document) => root.querySelector(sel);
const on  = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);
const onMany = (nodes, evt, fn, opts) => nodes.forEach(n => on(n, evt, fn, opts));


/* ------------------------------------------------------------------------ */
/* Fade helpers                                                             */
/* ------------------------------------------------------------------------ */


function fadeIn(el, duration = 200) {
    if (!el) return;
    el.style.removeProperty("display");
    if (getComputedStyle(el).display === "none") el.style.display = "block";
    el.style.opacity = 0; el.style.transition = "none";
    void el.offsetHeight;
    el.style.transition = `opacity ${duration}ms`;
    requestAnimationFrame(() => { el.style.opacity = 1; });
}

function fadeOut(el, duration = 200) {
    if (!el) return;
    el.style.opacity = 1;
    el.style.transition = `opacity ${duration}ms`;
    requestAnimationFrame(() => { el.style.opacity = 0; });
    setTimeout(() => { el.style.display = "none"; }, duration);
}


/* ------------------------------------------------------------------------ */
/* Visual state helpers                                                     */
/* ------------------------------------------------------------------------ */


function setBorderOK(el) {
    if (!el) return;
    el.style.borderBottomColor = CONFIG.styles.ok;
    el.style.borderColor = CONFIG.styles.ok;
}

function setBorderBAD(el) {
    if (!el) return;
    el.style.borderBottomColor = CONFIG.styles.bad;
    el.style.borderColor = CONFIG.styles.bad;
}

function showError(el) { fadeIn(el, 200); }
function hideError(el) { fadeOut(el, 200); }


/* ------------------------------------------------------------------------ */
/* Field validators                                                         */
/* ------------------------------------------------------------------------ */


const Validators = {
    required: (v) => !!v && v.trim().length > 0,
    email:    (v) => CONFIG.constraints.emailRegex.test(v || ""),
    phone:    (v) => CONFIG.constraints.phoneRegex.test((v || "").replace(/[^\d+]/g, "")),
    minLen:   (min) => (v) => (v || "").trim().length >= min,
    noUrls:   (v) => !CONFIG.constraints.urlRegex.test(v || ""),
};


/* ------------------------------------------------------------------------ */
/* Init on ready                                                            */
/* ------------------------------------------------------------------------ */


document.addEventListener("DOMContentLoaded", () => {

// Collect all elements up-front

const els = {
    form:        $1(CONFIG.selectors.form),
    response:    $1(CONFIG.selectors.response),
    nameInputs:  $$(CONFIG.selectors.nameInputs),
    emailInputs: $$(CONFIG.selectors.emailInputs),
    phoneInputs: $$(CONFIG.selectors.phoneInputs),
    msgInputs:   $$(CONFIG.selectors.messageInputs),
    errors: {
        name:        $1(CONFIG.selectors.errors.name),
        email:       $1(CONFIG.selectors.errors.email),
        phone:       $1(CONFIG.selectors.errors.phone),
        msgRequired: $1(CONFIG.selectors.errors.msgRequired),
        msgTooShort: $1(CONFIG.selectors.errors.msgTooShort),
        msgHasLinks: $1(CONFIG.selectors.errors.msgHasLinks),
    },
};

// Form wiring - Handle states of input fields if empty  

function wireRequiredInputs(inputs, errEl) {

    // On keyup change states of fields 

    onMany(inputs, "keyup", (e) => {
        const val = e.target.value;
        if (!Validators.required(val)) {
            setBorderBAD(e.target);
        } else {
            setBorderOK(e.target);
            hideError(errEl);
        }
    });

    // On blur change states of fields

    onMany(inputs, "blur", (e) => {
        const val = e.target.value;
        if (!Validators.required(val)) {
            setBorderBAD(e.target);
            showError(errEl);
        } else {
            hideError(errEl);
        }
    });

}

// Form wiring - Handle states of email, phone and message fields if incorrect  

// EMAIL INPUT WIRING

function wireEmailInputs(inputs, errEl) {

    // On keyup change states of fields 

    onMany(inputs, "keyup", (e) => {
        const val = e.target.value;
        if (!Validators.email(val)) {
            setBorderBAD(e.target);
        } else {
            setBorderOK(e.target);
            hideError(errEl);
        }
    });

    // On blur change states of fields 

    onMany(inputs, "blur", (e) => {
        const val = e.target.value;
        if (!Validators.email(val)) {
            setBorderBAD(e.target);
            showError(errEl);
        } else {
            hideError(errEl);
        }
    });

}

// PHONE INPUT WIRING

function wirePhoneInputs(inputs, errEl) {

    // On keyup change states of fields 

    onMany(inputs, "keyup", (e) => {
        const val = e.target.value;
        if (!Validators.phone(val)) {
            setBorderBAD(e.target);
        } else {
            setBorderOK(e.target);
            hideError(errEl);
        }
    });

    // On blur change states of fields 

    onMany(inputs, "blur", (e) => {
        const val = e.target.value;
        if (!Validators.phone(val)) {
            setBorderBAD(e.target);
            showError(errEl);
        } else {
            hideError(errEl);
        }
    });

}

// MESSAGE INPUT WIRING

function wireMessageInputs(inputs, errRequiredEl, errTooShortEl) {
    
    const min = CONFIG.constraints.minMessageLength;
    const passesRequired = Validators.required;
    const passesMin = Validators.minLen(min);

    // On keyup change states of fields 

    onMany(inputs, "keyup", (e) => {
        const val = e.target.value;
        const badUrl = CONFIG.constraints.blockUrls && !Validators.noUrls(val);

        if (!passesRequired(val) || !passesMin(val) || badUrl) {
            setBorderBAD(e.target);
        } else {
            setBorderOK(e.target);
            hideError(errRequiredEl);
            hideError(errTooShortEl);
            if (els.errors.msgHasLinks) hideError(els.errors.msgHasLinks);
        }
    });

    // On blur change states of fields 

    onMany(inputs, "blur", (e) => {
        const val = e.target.value;
        const badUrl = CONFIG.constraints.blockUrls && !Validators.noUrls(val);

        if (!passesRequired(val)) {
            setBorderBAD(e.target);
            showError(errRequiredEl);
            hideError(errTooShortEl);
            if (els.errors.msgHasLinks) hideError(els.errors.msgHasLinks);
        } else if (!passesMin(val)) {
            setBorderBAD(e.target);
            showError(errTooShortEl);
            hideError(errRequiredEl);
            if (els.errors.msgHasLinks) hideError(els.errors.msgHasLinks);
        } else if (badUrl) {
            setBorderBAD(e.target);
            hideError(errRequiredEl);
            hideError(errTooShortEl);
            if (els.errors.msgHasLinks) showError(els.errors.msgHasLinks);
        } else {
            hideError(errRequiredEl);
            hideError(errTooShortEl);
            if (els.errors.msgHasLinks) hideError(els.errors.msgHasLinks);
        }
    });

}

// Wire up using the generic functions above

wireRequiredInputs(els.nameInputs,  els.errors.name);
wireEmailInputs(els.emailInputs, els.errors.email);
wirePhoneInputs(els.phoneInputs, els.errors.phone);
wireMessageInputs( els.msgInputs,   els.errors.msgRequired, els.errors.msgTooShort, els.errors.msgHasLinks);


/* ------------------------------------------------------------------------ */
/* Submit: keep API the same by exposing window.SubmitFormData.             */
/* ------------------------------------------------------------------------ */


function SubmitFormData() {
    const nameInput  = els.nameInputs[0];   
    const emailInput = els.emailInputs[0];
    const phoneInput   = els.phoneInputs[0];
    const msgInput   = els.msgInputs[0];

    const name    = (nameInput?.value || "").trim();
    const email   = (emailInput?.value || "").trim();
    const phone   = (phoneInput?.value || "").trim();
    const message = (msgInput?.value || "").trim();

    let hasError = false;

    // Name
    if (!Validators.required(name)) {
        hasError = true;
        setBorderBAD(nameInput);
        showError(els.errors.name);
    }

    // Email
    if (!Validators.email(email)) {
        hasError = true;
        setBorderBAD(emailInput);
        showError(els.errors.email);
    }

    // Phone
    const phoneIsRequired = CONFIG.constraints.requirePhone;
    if ((phoneIsRequired || phone) && !Validators.phone(phone)) {  
        hasError = true;
        setBorderBAD(phoneInput);
        showError(els.errors.phone);
    }

    // Message
    if (!Validators.required(message)) {
        hasError = true;
        setBorderBAD(msgInput);
        hideError(els.errors.msgTooShort);
        showError(els.errors.msgRequired);
        hideError(els.errors.msgHasLinks);
    } else if (!Validators.minLen(CONFIG.constraints.minMessageLength)(message)) {
        hasError = true;
        setBorderBAD(msgInput);
        showError(els.errors.msgTooShort);
        hideError(els.errors.msgRequired);
        hideError(els.errors.msgHasLinks);
    } else if (CONFIG.constraints.blockUrls && !Validators.noUrls(message)) {
        hasError = true;
        setBorderBAD(msgInput);
        hideError(els.errors.msgTooShort);
        hideError(els.errors.msgRequired);
        showError(els.errors.msgHasLinks);
    } else {
        hideError(els.errors.msgRequired);
        hideError(els.errors.msgTooShort);
        hideError(els.errors.msgHasLinks);
    }

    if (hasError) return;

    // Success UI
    fadeOut(els.form, 350);
    setTimeout(() => fadeIn(els.response, 350), 350);

    // Submit via fetch (x-www-form-urlencoded like $.post)
    const body = new URLSearchParams({ name, email, phone, message });

    fetch(CONFIG.submitUrl, {
        method: "POST",
        headers: CONFIG.submitHeaders,
        body,
    })
    .then((r) => r.json())
    .then(() => {
        els.response.innerHTML = CONFIG.messages?.successHTML || "";
        els.form.reset();
    })
    .catch(() => {
        els.response.innerHTML = CONFIG.messages?.failHTML || "";
    });

}

// Expose globally if called inline (e.g., onclick="SubmitFormData()")
window.SubmitFormData = SubmitFormData;

});

