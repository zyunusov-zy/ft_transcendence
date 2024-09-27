const displayMessage2 = (message, isSuccess = true) => {
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('alert', 'mt-3');
    messageDiv.textContent = message;

    if (isSuccess) {
        messageDiv.classList.add('alert-success');
    } else {
        messageDiv.classList.add('alert-danger');
    }

    const loginForm = document.querySelector('#loginForm');
    if (loginForm) {
        loginForm.insertAdjacentElement('beforebegin', messageDiv);
    }
};

const handleLoginSub = async (event) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const inputExtra = document.getElementById('inputextra');
    const submit2fa = document.getElementById('submit2fa');

    try {
        const response = await fetch(form.action, {
            method: form.method,
            body: formData,
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
            },
        });

        const data = await response.json();

        if (data.success && !data.requires_2fa) {
            displayMessage2('Login successful!', true);
            window.location.href = '/#home';
        } else if (data.requires_2fa) {
            inputExtra.style.display = 'block';
            submit2fa.style.display = 'block';
            displayMessage2('Enter the 2FA code sent to your email.', true);

            document.getElementById('submit2fa').addEventListener('click', function() {
                handle2FASubmission();
            });
        } else {
            displayMessage2(data.errors, false);
        }
    } catch (error) {
        displayMessage2('Error submitting form. Please try again.', false);
    }
};

const handle2FASubmission = async () => {
    const inputExtra = document.getElementById('inputextra').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!inputExtra) {
        displayMessage2('Please enter the 2FA code.', false);
        return;
    }

    try {
        const response = await fetch('/verify-2fal/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({ username: username, password: password, code: inputExtra }), 
        });

        const data = await response.json();

        if (data.success) {
            displayMessage2('2FA verification successful!', true);
            window.location.href = '/#home';
        } else {
            displayMessage2(data.errors || 'Invalid or expired 2FA code. Please try again.', false);
        }
    } catch (error) {
        displayMessage2('Error verifying the 2FA code. Please try again.', false);
    }
};

