const form    = document.getElementById('forgotForm');
const msgBox  = document.getElementById('msgBox');
const btnText = document.getElementById('btnText');
const spinner = document.getElementById('spinner');

function showMsg(msg, type) {
    msgBox.textContent = msg;
    msgBox.className   = `alert alert-${type}`;
    msgBox.style.display = 'flex';
}

function setLoading(loading) {
    btnText.textContent = loading ? 'Sending…' : 'Send Reset Link';
    spinner.style.display = loading ? 'block' : 'none';
    form.querySelector('.btn-auth').disabled = loading;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgBox.style.display = 'none';
    setLoading(true);

    const email = document.getElementById('email').value.trim();

    try {
        const res  = await fetch('/forgot-password', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email })
        });
        const data = await res.json();

        if (res.ok) {
            showMsg(data.message, 'success');
            setTimeout(() => { window.location.href = data.redirect; }, 2500);
        } else {
            showMsg(data.message || 'Something went wrong.', 'error');
        }
    } catch (err) {
        showMsg('Network error. Please try again.', 'error');
    } finally {
        setLoading(false);
    }
});
