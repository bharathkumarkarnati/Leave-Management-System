
/* auth.js - Login, registration and forgot password */



let role = "Employee";

const err = function (message) {
    const element = $("err");

    if (!element) return;

    element.textContent = message;

    if (message) {
        const card = document.querySelector(".auth-card");

        if (card) {
            card.classList.remove("shake");
            void card.offsetWidth;
            card.classList.add("shake");
        }
    }
};


// Role selection
document.querySelectorAll("#roleSeg button").forEach(function (button) {
    button.addEventListener("click", function () {
        role = button.dataset.role;

        err("");

        document.querySelectorAll("#roleSeg button").forEach(function (item) {
            item.classList.toggle("on", item === button);
        });

        const codeField = $("codeField");

        if (codeField) {
            codeField.classList.toggle(
                "hidden",
                role !== "Administrator"
            );
        }
    });
});


// Show / hide password
document.querySelectorAll("[data-toggle]").forEach(function (button) {
    button.addEventListener("click", function () {
        const input = $(button.dataset.toggle);

        if (!input) return;

        input.type = input.type === "password" ? "text" : "password";

        button.textContent =
            input.type === "password" ? "Show" : "Hide";
    });
});


// Demo login buttons
document.querySelectorAll("[data-fill]").forEach(function (button) {
    button.addEventListener("click", function () {
        const details = button.dataset.fill.split("|");

        $("email").value = details[0];
        $("password").value = details[1];

        role = details[2];

        document.querySelectorAll("#roleSeg button").forEach(function (item) {
            item.classList.toggle("on", item.dataset.role === role);
        });

        err("");
    });
});


// Login
if ($("loginForm")) {
    $("loginForm").addEventListener("submit", function (event) {
        event.preventDefault();

        const email = $("email").value.trim();
        const password = $("password").value;

        if (!email || !password) {
            return err("Please enter your email and password.");
        }

        const employee = Auth.login(email, password, role);

        if (employee) {
            location.href = "app.html";
        }
    });
}


// Registration
if ($("registerForm")) {

    const departments = Store.all("departments");

    $("department").innerHTML = departments.map(function (department) {
        return `<option value="${department.id}">${esc(department.name)}</option>`;
    }).join("");


    // Password strength
    $("password").addEventListener("input", function () {
        const value = $("password").value;
        let strength = 0;

        if (value.length >= 6) strength++;
        if (value.length >= 10) strength++;
        if (/[A-Z]/.test(value) && /[a-z]/.test(value)) strength++;
        if (/\d/.test(value)) strength++;
        if (/[^A-Za-z0-9]/.test(value)) strength++;

        const bar = $("strength");

        bar.style.width = (strength * 20) + "%";

        bar.style.background = [
            "#dc2626",
            "#dc2626",
            "#d97706",
            "#d97706",
            "#16a34a",
            "#16a34a"
        ][strength];
    });


    // Registration submit
    $("registerForm").addEventListener("submit", function (event) {
        event.preventDefault();

        const name = $("name").value.trim();
        const email = $("email").value.trim();
        const password = $("password").value;
        const confirm = $("confirm").value;

        if (!name) {
            return err("Please enter your full name.");
        }

        if (!email) {
            return err("Please enter your email.");
        }

        if (password.length < 6) {
            return err("Password must contain at least 6 characters.");
        }

        if (password !== confirm) {
            return err("Passwords do not match.");
        }

        const employee = Auth.register({
            name: name,
            email: email,
            phone: $("phone").value,
            department_id: $("department").value,
            password: password,
            role: role,
            admin_code: $("adminCode")
                ? $("adminCode").value.trim()
                : ""
        });

        if (employee) {
            location.href = "app.html";
        }
    });
}


// Forgot password
if ($("forgotForm")) {
    $("forgotForm").addEventListener("submit", function (event) {
        event.preventDefault();

        const email = $("email").value.trim();
        const employeeCode = $("empCode").value.trim();
        const password = $("password").value;

        if (!email || !employeeCode || !password) {
            return err("Please complete all fields.");
        }

        if (password.length < 6) {
            return err("Password must contain at least 6 characters.");
        }

        const success = Auth.resetPassword(
            email,
            employeeCode,
            password
        );

        if (!success) return;

        toast("Password updated. Redirecting to log in...");

        setTimeout(function () {
            location.href = "login.html";
        }, 1200);
    });
}
