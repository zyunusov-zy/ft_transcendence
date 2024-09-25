function showEditProfileModal() {
    const modal = document.getElementById('editProfileModal');
    const span = document.getElementsByClassName('close')[0];

    if (!modal || !span) {
        console.error('Modal elements not found');
        return;
    }

    modal.style.display = 'block';

    span.onclick = function() {
        modal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(editProfileForm);
            try {
                const response = await fetch('/api/edit-profile/', {
                    method: 'POST',
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
                    console.log('Profile updated successfully');
                    modal.style.display = 'none';
                    location.reload();
                } else {
                    console.error('Profile update failed', data.error);
                    document.getElementById('error-message').innerText = data.error;
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                document.getElementById('error-message').innerText = error;
            }
        });
    }
}
