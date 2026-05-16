const form    = document.getElementById('loginForm');
const errBox  = document.getElementById('errBox');
const btnText = document.getElementById('btnText');
const spinner = document.getElementById('spinner');

function showError(msg) {
    errBox.textContent = msg;
    errBox.className = 'alert alert-error';
    errBox.style.display = 'flex';
}

function setLoading(loading) {
    btnText.textContent = loading ? 'Signing in…' : 'Sign In';
    spinner.style.display = loading ? 'block' : 'none';
    form.querySelector('.btn-auth').disabled = loading;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.style.display = 'none';
    setLoading(true);

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
        const res  = await fetch('/login', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok && data.redirect) {
            window.location.href = data.redirect;
        } else {
            showError(data.message || 'Invalid email or password');
            setLoading(false);
        }
    } catch (err) {
        showError('Network error. Please try again.');
        setLoading(false);
    }
});

document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.getElementById('navToggle');
  var links = document.querySelector('.nav-links');

  toggle.addEventListener('click', function () {
    links.classList.toggle('active');
  });
});
