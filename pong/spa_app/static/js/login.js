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
            // Redirect or navigate to the home page
            window.location.href = '/#home'; // or use a router method if available
        } else {
            console.error('Login failed', data.errors);
            displayLoginError(data.errors);
        }
    } catch (error) {
        console.error('Error submitting form:', error);
    }
};

const displayLoginError = (error) => {
    const errorDiv = document.createElement('div');
    errorDiv.classList.add('alert', 'alert-danger', 'mt-3');
    errorDiv.textContent = error;

    const loginForm = document.querySelector('#loginForm');
    if (loginForm) {
        loginForm.insertAdjacentElement('beforebegin', errorDiv);
    }
};
