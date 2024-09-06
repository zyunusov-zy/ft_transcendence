const handleSignupSub = async (event) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const existingMessageDiv = form.previousElementSibling;
    if (existingMessageDiv && existingMessageDiv.classList.contains('alert')) {
        existingMessageDiv.remove();
    }

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
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('alert', 'alert-success', 'mt-3');
            messageDiv.textContent = data.message;

            form.insertAdjacentElement('beforebegin', messageDiv);
        } else {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('alert', 'alert-danger', 'mt-3');
            messageDiv.textContent = data.errors;

            form.insertAdjacentElement('beforebegin', messageDiv);
        }

    } catch (error) {
        console.error('Error submitting form:', error);
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('alert', 'alert-danger', 'mt-3');
        messageDiv.textContent = 'An error occurred. Please try again.';
        form.insertAdjacentElement('beforebegin', messageDiv);
    }
};
