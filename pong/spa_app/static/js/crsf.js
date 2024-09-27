const getCookie = (name) => {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
};

const initialize = async () => {
    await fetchCSRFToken('/fetch-csrf-token/');
};

const fetchCSRFToken = async () => {
    try {
        const response = await fetch('/fetch-csrf-token/');
        const data = await response.json();
        document.cookie = `csrftoken=${data.csrfToken}`;
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
    }
};

document.addEventListener("DOMContentLoaded", initialize);