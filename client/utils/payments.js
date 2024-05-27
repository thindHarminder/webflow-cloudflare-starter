import {
    Render
} from "thind-js";
export function showPaymentsDialog() {
    const dialog = thind.element.get("payments_dialog")
    dialog.classList.add('show');
    const plansList = thind.element.get("plans_list_wrapper")
    setTimeout(() => {
        plansList.classList.add('show');
    }, 100);
}

export function hidePaymentsDialog() {
    const plansList = thind.element.get("plans_list_wrapper")
    plansList.classList.remove('show');
    const dialog = thind.element.get("payments_dialog")
    setTimeout(() => {
        dialog.classList.remove('show');
    }, 400);
}

export async function initPaymentsDialog(dataStore) {
    await import(`https://js.stripe.com/v3/`);   
    dataStore.update("showPaymentsDialog", false);
    const closeDialogButtons = thind.element.getAll("dialog_close");
    if (closeDialogButtons) {
        closeDialogButtons.forEach(button => {
            button.addEventListener("click", () => {
                const parentDialog = button.closest("dialog");
                const form = parentDialog.querySelector("form");
                if (form) {
                    thind.form.reset(form);
                }
                parentDialog.close();
            });
        });
    }
    const paymentCLoseElements = thind.element.getAll("payments_dialog_close");
    if (paymentCLoseElements) {
        paymentCLoseElements.forEach(button => {
            button.addEventListener("click", () => {
                dataStore.update("showPaymentsDialog", false);
            });
        });
    }
    await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/plans`)
        .then(response => response.json())
        .then(response => {
            if (response.plans) {
                const plans = response.plans.sort((a, b) => a.price - b.price);
                dataStore.update("plans", plans);
                renderPlans(dataStore);
                showPaymentsDialog() // show the dialog
            }
        })
        .catch(error => {
            console.error(error);
        });
}


async function renderPlans(dataStore) {
    const plansList = new Render({
        element: thind.element.get("plans_card"),
        dataStore: dataStore,
        key: "plans",
        prop: "thind",
        hideEmptyParent: true,
        clearOnUpdate: true,
        config: {
            props: {
                plan_title: {
                    dataKey: "name",
                    action: (value, element) => {
                        element.textContent = value;
                    }
                },
                plan_description: {
                    dataKey: "description",
                    action: (value, element) => {
                        element.textContent = value;
                    }
                },
                plan_price: {
                    dataKey: "price",
                    action: (value, element) => {
                        element.textContent = `USD $${value}`;
                    }
                },
                plan_features: {
                    dataKey: "features",
                    action: (value, element) => {
                        element.innerHTML = "";
                        value.forEach(feature => {
                            const li = document.createElement("li");
                            li.textContent = feature;
                            element.appendChild(li);
                        });
                    }
                },
                select_plan: {
                    dataKey: "id",
                    action: (value, element) => {
                       handlePayment(value, element);
                    }
                 },
                plan_interval: {
                    dataKey: "interval",
                    action: (value, element) => {
                        element.textContent = value;
                    }
                }

        },

    }   
    });
}

async function handlePayment(planId, element) {
    if (planId === dataStore.get("user.todoPlan")) {
        element.classList.add("is-secondary");
        element.style.pointerEvents = "none";
        element.textContent = "Current Plan";
    }else{
        element.classList.remove("is-secondary");
        element.style.pointerEvents = "auto";
        element.textContent = "Select Plan";
    }
    element.addEventListener("click", async () => {
        element.textContent = "Loading...";
       const response = await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/create-checkout-session/${planId}`, {
            headers: {
                "Content-Type": "application/json"
            }
        })
        .then(response => response.json())
        .then(response => {
            if (response.success === true) {
                triggertCheckoutSession(response.client_secret);
            }else{
                console.error(response.message);
                showToast("An error occurred while ceating checkout", "error");
            }
        })
    })
}

async function triggertCheckoutSession(clientSecret) {
    const checkoutDiv = thind.element.get("checkout_div");
    
    try {
        const stripe = Stripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
        const checkout = await stripe.initEmbeddedCheckout({
            clientSecret,
          });
    
        checkout.mount('#checkout');
    } catch (error) {
        console.error(error);
        setTimeout(() => {
            triggertCheckoutSession(clientSecret);
        }, 2000);
    }

    const plansDiv = thind.element.get("plans_list_wrapper");
    plansDiv.classList.remove('show');
    checkoutDiv.classList.add('show');
}