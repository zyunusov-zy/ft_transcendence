const handleLoginSub = async (event) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    try {
        const response = await fetch(form.action, {
            method: form.method,
            body: formData,
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
            },
        });

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.success) {
            console.log('Login successful');
            window.location.href = '/#home';
        } else {
            console.error('Login failed', data.errors);
            displayLoginError(data.errors);
        }
    } catch (error) {
        console.error('Error submitting form:', error);
    }
};

const displayLoginError = (error) => {
    // Remove any existing error messages
    const existingErrorDiv = document.querySelector('.alert-danger');
    if (existingErrorDiv) {
        existingErrorDiv.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.classList.add('alert', 'alert-danger', 'mt-3');
    errorDiv.textContent = error;

    const loginForm = document.querySelector('#loginForm');
    if (loginForm) {
        loginForm.insertAdjacentElement('beforebegin', errorDiv);
    }
};