const devicePayload = {
    appStartupFlowState: "UpdateData",
    aumLoggedInUserId: 1,
    batteryLevel: 70,
    currentPouchId: 2,
    currentTakingTime: "2024-03-29T12:00:00",
    drawerState: "Closed",
    deviceInfoInterval: 11,
    lidState: "Closed",
    medicationFlowState: "MedicationPaused",
    pouchRollInLeftMechanic: 3,
    pouchRollInRightMechanic: 4,
    powerSupplyIsOn: true,
    prepareMedicationFlowState: "SearchForPouch",
    progressUntilDue: 5.6,
    remoteCommandInterval: 60,
    specialCondition: "UnderSupportMaintenance",
};

const loginForm = document.getElementById("login-form");
const appContent = document.getElementById("uploadDeviceStatus");
const statusMessageElement = document.getElementById("statusMessage");
const messageElement = document.getElementById("message");

let accessToken = localStorage.getItem("accessToken");

if (accessToken) {
    appContent.style.display = "block";
} else {
    loginForm.style.display = "block";
}

async function handleLogin() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

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

        loginForm.style.display = "none";
        appContent.style.display = "block";
    } catch (error) {
        console.error("Error during login:", error);
        messageElement.textContent = "Login failed. Please try again.";
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
    aumLoggedInUserId: 1,
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
        "TakeMedication",
        "NotWithdrawn",
        "DispenseFailed",
        "DropFailed",
    ],
    pouchRollInLeftMechanic: 3,
    pouchRollInRightMechanic: 4,
    powerSupplyIsOn: true,
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

        document.getElementById("statusMessage").textContent =
            "Device status submitted successfully! This form will automatically submit every 60 seconds.";
    } catch (error) {
        console.error("Error during status submission:", error);
        document.getElementById("statusMessage").textContent =
            "Failed to submit device status. Please try to login again.";
        localStorage.clear("accessToken");
    }
}

const handleSubmitForm = () => {
    updateDeviceStatus();

    let isRepeatEnabled = document.getElementById("repeatToggle").checked;
    let submitButton = document.getElementById("submitButton");

    if (isRepeatEnabled) {
        setInterval(updateDeviceStatus, 60000);
        submitButton.disabled = true;
    }
}

const handleLogout = () => {
    localStorage.clear("accessToken");
    location.reload();
};

function toggleTheme(theme = null) {
    const icon = document.getElementById("theme-icon");


    let currentTheme = theme || localStorage.getItem("theme") || "dark";
    if (!theme) {
        currentTheme = currentTheme === "dark" ? "light" : "dark";
        icon.textContent = currentTheme === "dark" ? "🌙" : "☀️";

    }

    document.body.style.backgroundColor =
        currentTheme === "dark" ? "#282828" : "#f7f9fc";
    document.body.style.color =
        currentTheme === "dark" ? "white" : "#282828";
    icon.textContent = currentTheme === "dark" ? "🌙" : "☀️";


    const backgroundColor = currentTheme === "dark" ? "#161515" : "white";
    document.getElementById("login-form").style.backgroundColor =
        backgroundColor;
    document.getElementById("uploadDeviceStatus").style.backgroundColor =
        backgroundColor;

    localStorage.setItem("theme", currentTheme);
}

document.addEventListener("DOMContentLoaded", () =>
    toggleTheme(localStorage.getItem("theme"))
);