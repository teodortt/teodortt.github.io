

const navbar = document.getElementById('nav');
const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("loginButton");
const appContent = document.getElementById("uploadDeviceStatus");
const statusMessage = document.getElementById("statusMessage");
const repeatToggle = document.getElementById('repeatToggle');
const rememberMeCheckbox = document.getElementById('remember-me');
const submitButton = document.getElementById("submitButton");

let accessToken = localStorage.getItem("accessToken");
let intervalRequestId, intervalCounterId;

const storedUsername = localStorage.getItem('username');
const storedPassword = localStorage.getItem('password');
if (storedUsername) {
    document.getElementById('username').value = storedUsername;
    document.getElementById('password').value = storedPassword;
}

if (accessToken) {
    appContent.style.display = "block";
    navbar.style.display = "flex";
} else {
    loginForm.style.display = "block";
}

async function handleLogin() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const messageElement = document.getElementById("loginMessage");
    messageElement.textContent = "";

    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";

    try {
        const response = await fetch(
            "https://device-api.smila-cloud.dev.jdm.de/device-api/authentication/login",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        localStorage.setItem("accessToken", data.accessToken);
        accessToken = data.accessToken;

        if (rememberMeCheckbox.checked) {
            localStorage.setItem('username', document.getElementById('username').value);
            localStorage.setItem('password', document.getElementById('password').value);
        }

        loginForm.style.display = "none";
        appContent.style.display = "block";
        navbar.style.display = "flex";
    } catch (error) {
        console.error("Error during login:", error);
        messageElement.textContent = "Login failed. Please try again.";
        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }
}

const devicePayloadOptions = {
    appStartupFlowState: [
        "UpdateData",
        "PingHardware",
        "HardwareConnectionError",
        "GetHardwareStatus",
        "HardwareError",
        "EvaluateCurrent",
        "StartPouchPictureDeletionFlow",
        "StartBatteryHousekeepingFlow",
        "StartSmilaSetupFlow",
        "StartSmilaOnboardingFlow",
        "StartMedicationFlow",
        "RefreshCloudToken",
    ],
    aumLoggedInUserId: 0,
    batteryLevel: 70,
    currentPouchId: 2,
    currentTakingTime: new Date().toISOString(),
    drawerState: ["Closed", "Open", "NearlyFull", "Full"],
    deviceInfoInterval: 11,
    lidState: ["Closed", "Open", "UnauthorizedOpen"],
    medicationFlowState: [
        "MedicationPaused",
        "WaitingForMedicationPlan",
        "WaitingForRoll",
        "PrepareMedication",
        "Idle",
        "MedicationDue",
        "TakingTimeSoonOver",
        "MedicationMissed",
        "CutAndDispense",
        "CutAndDrop",
        "MedicationReadyToBeTaken",
        "MedicationNotTakenYet",
        "DispenseFailed",
        "DropFailed",
        "EmergencyStop",
        "FailedToPrepareMedication",
        "MedicationSuccessfullyTaken"
    ],
    pouchRollInLeftMechanic: 3,
    pouchRollInRightMechanic: 4,
    prepareMedicationFlowState: [
        "SearchForPouch",
        "EndSwitchNotTriggered",
        "NotAllowedToPrepare",
        "BarcodeNotFound",
        "WrongBarcode",
        "SetBackupDispenseTime",
        "TakeCuttingOffsetImage",
        "CalculateCuttingOffset",
        "EscalateCuttingOffset",
        "PouchNotInCuttablePosition",
        "RecalculateOffset",
        "SetCuttingOffset",
    ],
    progressUntilDue: 5.6,
    remoteCommandInterval: 60,
    specialCondition: [
        "None",
        "UnderSupportMaintenance",
        "GoingToHibernate",
        "RestartForAppUpdate",
        "RestartFromAum",
        "GoingToShutDown",
    ],
    powerSupplyIsOn: true,
};

// Generate the form fields dynamically
const form = document.getElementById("deviceForm");

Object.keys(devicePayloadOptions).forEach((key) => {
    const label = document.createElement("label");
    label.textContent = key;
    label.htmlFor = key;

    if (Array.isArray(devicePayloadOptions[key])) {
        const select = document.createElement("select");
        select.name = key;
        select.id = key;

        devicePayloadOptions[key].forEach((value) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
        form.appendChild(label);
        form.appendChild(select);
    } else {
        // Create an input field for other types
        const input = document.createElement("input");
        input.name = key;
        input.id = key;

        if (typeof devicePayloadOptions[key] === "number") {
            input.type = "number";
            input.value = devicePayloadOptions[key];
            input.min = 0;
        } else if (typeof devicePayloadOptions[key] === "boolean") {
            input.type = "checkbox";
            input.checked = devicePayloadOptions[key];
            input.className = 'toggle';
        } else if (
            new Date(devicePayloadOptions[key]) !== "Invalid Date" &&
            !isNaN(new Date(devicePayloadOptions[key]))
        ) {
            input.type = "datetime-local";
            input.value = devicePayloadOptions[key].slice(0, 16);
        } else {
            input.type = "text";
            input.value = devicePayloadOptions[key];
        }
        form.appendChild(label);
        form.appendChild(input);
    }
});

async function updateDeviceStatus() {
    const formData = new FormData(form);
    const payload = {};

    for (const [key, value] of formData.entries()) {
        payload[key] = value;
    }

    // Convert boolean inputs back to boolean
    payload.powerSupplyIsOn = form.powerSupplyIsOn.checked;

    // convert aumLoggedInUserId to null if it is 0
    if (payload.aumLoggedInUserId == 0) {
        payload.aumLoggedInUserId = null;
    }


    try {
        const response = await fetch(
            "https://device-api.smila-cloud.dev.jdm.de/device-api/devicestatusinfo",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
                },
                body: JSON.stringify(payload),
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return true;

    } catch (error) {
        console.error("Error during status submission:", error);
        statusMessage.textContent =
            "Failed to submit device status.";
        checkTokenExpiry();
    }
}

const handleSubmitForm = () => {
    updateDeviceStatus().then((status) => {

        if (status) {
            if (repeatToggle.checked) {
                intervalRequestId = setInterval(updateDeviceStatus, 60000);
                submitButton.disabled = true;

                let countdown = 60;

                intervalCounterId = setInterval(() => {
                    countdown--;
                    if (countdown >= 0) {
                        statusMessage.textContent =
                            `Device status submitted successfully! This form will automatically submit in ${countdown} seconds.`;
                    }

                    if (countdown < 1) {
                        countdown = 60;
                    }
                }, 1000);
            } else {
                statusMessage.textContent = `Device status submitted successfully!`;
            }
            return;
        }
        statusMessage.textContent =
            "Failed to submit device status. Please try to login again.";
    });

}

const handleClearInterval = () => {
    clearInterval(intervalRequestId);
    clearInterval(intervalCounterId);
    statusMessage.textContent = "";
    submitButton.disabled = false;
}

const handleLogout = () => {
    localStorage.removeItem("accessToken");
    location.reload();
};

const checkTokenExpiry = () => {
    const accessToken = localStorage.getItem('accessToken');

    if (!accessToken) {
        console.log('No access token found.');
        return;
    }

    try {
        const payloadBase64 = accessToken.split('.')[1];
        const payloadJson = atob(payloadBase64);
        const payload = JSON.parse(payloadJson);

        if (!payload.exp) {
            console.log('No expiration time (exp) in token.');
            return;
        }

        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp < currentTime) {
            handleLogout();
        } else {
            console.log('Token is valid.');
        }
    } catch (error) {
        console.error('Error decoding token:', error);
    }
}

const toggleTheme = (theme = null) => {
    const icon = document.getElementById("theme-icon");

    let currentTheme = theme || localStorage.getItem("theme") || "dark";
    if (!theme) {
        currentTheme = currentTheme === "dark" ? "light" : "dark";
        icon.textContent = currentTheme === "dark" ? "🌙" : "☀️";
    }

    document.body.style.backgroundColor =
        currentTheme === "dark" ? "#161515" : "#f7f9fc";
    document.body.style.color =
        currentTheme === "dark" ? "white" : "#161515";
    icon.textContent = currentTheme === "dark" ? "🌙" : "☀️";

    // Animate icon
    icon.classList.add('theme-icon-rotate');
    setTimeout(() => icon.classList.remove('theme-icon-rotate'), 500);

    const backgroundColor = currentTheme === "dark" ? "#282828" : "white";
    document.getElementById("login-form").style.backgroundColor =
        backgroundColor;
    document.getElementById("uploadDeviceStatus").style.backgroundColor =
        backgroundColor;

    localStorage.setItem("theme", currentTheme);
}

document.addEventListener("DOMContentLoaded", () => {
    checkTokenExpiry();
    toggleTheme(localStorage.getItem("theme"));
});

repeatToggle.addEventListener('change', () => {
    if (!repeatToggle.checked) {
        handleClearInterval();
    }
});