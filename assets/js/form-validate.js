/* ------------------------------------------------------------------------ */
/* Config: tweak selectors, styles, behavior                                */
/* ------------------------------------------------------------------------ */


const CONFIG = {
    selectors: {
        form:               "#contact-form",
        response:           "#form-response",
        nameInputs:         "input[type='text']",
        emailInputs:        "input[type='email']",
        phoneInputs:        "input[type='tel']",
        messageInputs:      "textarea",
        errors: {
            name:         ".error-name",
            email:        ".error-mail",
            phone:       ".error-phone",
            msgRequired:  ".error-empty",
            msgTooShort:  ".error-too-short",
        },
    },

    styles: {
        ok:  "#6ae6bc",
        bad: "#FF8282",
    },
    constraints: {
        minMessageLength: 10,
        emailRegex: /^\S+@\S+\.\S+$/,
    },
    // Network settings
    submitUrl: "/php-files/contact-form-submit.php",
    submitHeaders: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
};


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
    phone:    (v) => /^(\+?\d{7,15})$/.test((v || "").replace(/[^\d+]/g, "")),
    minLen:   (min) => (v) => (v || "").trim().length >= min,
};


/* ------------------------------------------------------------------------ */
/* Init on ready                                                            */
/* ------------------------------------------------------------------------ */


document.addEventListener("DOMContentLoaded", () => {

// Collect all elements up-front

const els = {
    form:        $1(CONFIG.selectors.form),
    response: $1(CONFIG.selectors.response),
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
        if (!passesRequired(val) || !passesMin(val)) {
            setBorderBAD(e.target);
        } else {
            setBorderOK(e.target);
            hideError(errRequiredEl);
            hideError(errTooShortEl);
        }
    });

    // On blur change states of fields 

    onMany(inputs, "blur", (e) => {
        const val = e.target.value;
        if (!passesRequired(val)) {
            setBorderBAD(e.target);
            showError(errRequiredEl);
            hideError(errTooShortEl);
        } else if (!passesMin(val)) {
            setBorderBAD(e.target);
            showError(errTooShortEl);
            hideError(errRequiredEl);
        } else {
            hideError(errRequiredEl);
            hideError(errTooShortEl);
        }
    });

}

// Wire up using the generic functions above

wireRequiredInputs(els.nameInputs,  els.errors.name);
wireEmailInputs(els.emailInputs, els.errors.email);
wirePhoneInputs(els.phoneInputs, els.errors.phone);
wireMessageInputs( els.msgInputs,   els.errors.msgRequired, els.errors.msgTooShort);


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
    if (!Validators.phone(phone)) {
        hasError = true;
        setBorderBAD(phoneInput);
        showError(els.errors.phone);
    }

    // Message
    if (!Validators.required(message)) {
        hasError = true;
        setBorderBAD(msgInput);
        showError(els.errors.msgRequired);
        hideError(els.errors.msgTooShort);
    } else if (!Validators.minLen(CONFIG.constraints.minMessageLength)(message)) {
        hasError = true;
        setBorderBAD(msgInput);
        showError(els.errors.msgTooShort);
        hideError(els.errors.msgRequired);
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
    .then((data) => {
        els.response.innerHTML = data.message || "<i class='uil uil-check-circle success-icon'></i><h1>That’s a wrap!</h1><h2>Your message was received without a glitch — standby for a reply.</h2>";
        els.form.reset();
    })
    .catch(() => {
        els.response.innerHTML = "<i class='uil uil-times-circle fail-icon'></i><h1>Oops, that’s on me.</h1><h3>Looks like my servers are taking a quick break. Give it another go in a moment!</h3>";
    });

}

// Expose globally if called inline (e.g., onclick="SubmitFormData()")
window.SubmitFormData = SubmitFormData;
});

