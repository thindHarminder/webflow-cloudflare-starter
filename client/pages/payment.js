const paymentSuccessElements = thind.element.getAll("payment_success");
paymentSuccessElements.forEach(element => {
    element.classList.add("hide");
});
const paymentFailedElements = thind.element.getAll("payment_failed");
paymentFailedElements.forEach(element => {
    element.classList.add("hide");
});

import { initPaymentsDialog } from "../utils/payments";

const sessionId = thind.page.parameter('session_id');
async function fetchSessionStatus(){
    await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/check-payment-status/${sessionId}`, {
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(response => response.json())
    .then(response => {
        if (response.status === "complete") {
            dataStore.update('user.reachedMaxTodo', false);
            paymentSuccessElements.forEach(element => {
                element.classList.remove("hide");
            });
            showToast("Payment successful", "success");
        } else {
            console.error(response.message);
            showToast("Payment failed", "error");
            paymentFailedElements.forEach(element => {
                element.classList.remove("hide");
            });
        }
    })
}

fetchSessionStatus();


const poaymentRetryButton = thind.element.get("payment_retry");
poaymentRetryButton.addEventListener("click", () => {
    initPaymentsDialog(dataStore);
});