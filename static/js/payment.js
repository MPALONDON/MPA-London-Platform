document.addEventListener('DOMContentLoaded', function() {
    const paymentForm = document.getElementById('paymentForm');
    const cardNumber = document.getElementById('cardNumber');
    const expiryDate = document.getElementById('expiryDate');
    const cvv = document.getElementById('cvv');
    const termsCheckbox = document.getElementById('terms');

    // Format card number with spaces
    cardNumber.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\s/g, '');
        let formattedValue = '';
        for(let i = 0; i < value.length; i++) {
            if(i > 0 && i % 4 === 0) {
                formattedValue += ' ';
            }
            formattedValue += value[i];
        }
        e.target.value = formattedValue;
    });

    // Format expiry date
    expiryDate.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if(value.length >= 2) {
            value = value.slice(0,2) + '/' + value.slice(2);
        }
        e.target.value = value;
    });

    // Validate CVV
    cvv.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3);
    });

    // Form submission
    paymentForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Validate form
        if(!validateForm()) {
            return;
        }

        // Show loading state
        const submitButton = paymentForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Processing...';
        submitButton.disabled = true;

        try {
            // Get form data
            const formData = new FormData(paymentForm);
            const data = Object.fromEntries(formData.entries());

            // Send payment data to server
            const response = await fetch('/api/payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if(response.ok) {
                // Show success message and redirect
                showAlert('Payment successful! Redirecting to confirmation page...', 'success');
                setTimeout(() => {
                    window.location.href = '/enrolment-confirmation';
                }, 2000);
            } else {
                throw new Error(result.message || 'Payment failed');
            }
        } catch(error) {
            showAlert(error.message, 'danger');
        } finally {
            // Reset button state
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    });

    function validateForm() {
        let isValid = true;
        const errors = [];

        // Validate card number
        if(!cardNumber.value.replace(/\s/g, '').match(/^\d{16}$/)) {
            errors.push('Please enter a valid 16-digit card number');
            isValid = false;
        }

        // Validate expiry date
        if(!expiryDate.value.match(/^(0[1-9]|1[0-2])\/([0-9]{2})$/)) {
            errors.push('Please enter a valid expiry date (MM/YY)');
            isValid = false;
        }

        // Validate CVV
        if(!cvv.value.match(/^\d{3}$/)) {
            errors.push('Please enter a valid 3-digit CVV');
            isValid = false;
        }

        // Validate terms
        if(!termsCheckbox.checked) {
            errors.push('Please accept the terms and conditions');
            isValid = false;
        }

        // Show errors if any
        if(errors.length > 0) {
            showAlert(errors.join('<br>'), 'danger');
        }

        return isValid;
    }

    function showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = message;

        const formContainer = document.querySelector('.payment-form-container');
        formContainer.insertBefore(alertDiv, formContainer.firstChild);

        // Remove alert after 5 seconds
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }
}); 