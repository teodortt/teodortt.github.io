

const navbar = document.getElementById('nav');
const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("loginButton");
const appContent = document.getElementById("uploadDeviceStatus");
const statusMessage = document.getElementById("statusMessage");
const repeatToggle = document.getElementById('repeatToggle');
const rememberMeCheckbox = document.getElementById('remember-me');
const submitButton = document.getElementById("submitButton");

const API_BASE_URL = "https://device-api.smila-cloud.dev.jdm.de/device-api";
// Refresh this many ms before the access token expires (token lifetime is ~90s).
const TOKEN_REFRESH_MARGIN_MS = 20000;

let accessToken = localStorage.getItem("accessToken");
let intervalRequestId, intervalCounterId;
let refreshTimeoutId = null;
let refreshPromise = null;

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

const getTokenExpiryMs = (token) => {
    try {
        const payloadBase64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(payloadBase64));
        return payload.exp ? payload.exp * 1000 : null;
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
};

const saveTokens = (data) => {
    if (typeof data.accessToken !== "string" || !data.accessToken ||
        typeof data.refreshToken !== "string" || !data.refreshToken) {
        throw new Error("Authentication response is missing valid tokens.");
    }

    const expiresAt =
        getTokenExpiryMs(data.accessToken) ??
        (Number.isFinite(data.accessTokenExpiresIn) && data.accessTokenExpiresIn > 0
            ? Date.now() + data.accessTokenExpiresIn * 1000
            : null);
    if (!expiresAt || expiresAt <= Date.now()) {
        throw new Error("Authentication response has no valid access token expiry.");
    }

    accessToken = data.accessToken;
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);

    localStorage.setItem("accessTokenExpiresAt", String(expiresAt));

    scheduleTokenRefresh();
};

const getAccessTokenExpiresAt = () => {
    const stored = Number(localStorage.getItem("accessTokenExpiresAt"));
    if (stored) return stored;
    const token = localStorage.getItem("accessToken");
    return token ? getTokenExpiryMs(token) : null;
};

const scheduleTokenRefresh = () => {
    clearTimeout(refreshTimeoutId);
    const expiresAt = getAccessTokenExpiresAt();
    if (!expiresAt) return;

    const delay = Math.max(expiresAt - Date.now() - TOKEN_REFRESH_MARGIN_MS, 0);
    refreshTimeoutId = setTimeout(() => {
        refreshAccessToken().catch(() => { });
    }, delay);
};

const isAccessTokenExpiring = () => {
    const expiresAt = getAccessTokenExpiresAt();
    return !expiresAt || expiresAt - Date.now() <= TOKEN_REFRESH_MARGIN_MS;
};

// Serializes refreshes across browser tabs that share localStorage.
const withRefreshLock = (callback) =>
    navigator.locks?.request
        ? navigator.locks.request("smila-token-refresh", callback)
        : callback();

// Refresh tokens are single-use (rotated on every refresh), so concurrent
// callers (and tabs) must not send the same refresh token twice.
// `rejectedAccessToken` is a token the server returned 401 for; it forces a
// refresh even if the token has not reached its expiry time yet.
const refreshAccessToken = (rejectedAccessToken = null) => {
    if (refreshPromise) return refreshPromise;

    refreshPromise = withRefreshLock(async () => {
        const currentAccessToken = localStorage.getItem("accessToken");
        const refreshToken = localStorage.getItem("refreshToken");

        if (!currentAccessToken || !refreshToken) {
            handleLogout();
            throw new Error("No tokens available to refresh.");
        }

        // Another tab may have refreshed while we were waiting for the lock.
        if (currentAccessToken !== rejectedAccessToken && !isAccessTokenExpiring()) {
            accessToken = currentAccessToken;
            scheduleTokenRefresh();
            return currentAccessToken;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/authentication/refresh-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessToken: currentAccessToken, refreshToken }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            saveTokens(data);
            console.log("Access token refreshed.");
            return data.accessToken;
        } catch (error) {
            console.error("Error refreshing token:", error);
            handleLogout();
            throw error;
        }
    }).finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
};

const getValidAccessToken = async () => {
    if (isAccessTokenExpiring()) {
        return refreshAccessToken();
    }
    return localStorage.getItem("accessToken");
};

// Keep tabs in sync: pick up tokens refreshed elsewhere and follow logouts.
window.addEventListener("storage", (event) => {
    if (event.key === "accessTokenExpiresAt" && event.newValue) {
        accessToken = localStorage.getItem("accessToken");
        scheduleTokenRefresh();
    } else if (event.key === "accessToken" && !event.newValue) {
        clearTimeout(refreshTimeoutId);
        location.reload();
    }
});

async function handleLogin() {
    if (loginButton.disabled) return;

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const messageElement = document.getElementById("loginMessage");
    messageElement.textContent = "";
    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";

    try {
        const response = await fetch(
            `${API_BASE_URL}/authentication/login`,
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
        saveTokens(data);

        if (rememberMeCheckbox.checked) {
            localStorage.setItem('username', username);
            localStorage.setItem('password', password);
        }

        loginForm.style.display = "none";
        appContent.style.display = "block";
        navbar.style.display = "flex";
    } catch (error) {
        console.error("Error during login:", error);
        messageElement.textContent = "Login failed. Please try again.";
    } finally {
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


    const postStatus = (token) =>
        fetch(`${API_BASE_URL}/devicestatusinfo`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

    try {
        const token = await getValidAccessToken();
        let response = await postStatus(token);

        if (response.status === 401) {
            response = await postStatus(await refreshAccessToken(token));
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return true;

    } catch (error) {
        console.error("Error during status submission:", error);
        statusMessage.textContent =
            "Failed to submit device status.";
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
    clearTimeout(refreshTimeoutId);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("accessTokenExpiresAt");
    location.reload();
};

const initAuthSession = () => {
    if (!localStorage.getItem('accessToken')) {
        console.log('No access token found.');
        return;
    }

    if (!localStorage.getItem('refreshToken')) {
        // Session from before refresh support; can't be renewed.
        const expiresAt = getAccessTokenExpiresAt();
        if (!expiresAt || expiresAt < Date.now()) handleLogout();
        return;
    }

    // Refreshes immediately if the token is already expired or about to expire.
    scheduleTokenRefresh();
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
    initAuthSession();
    toggleTheme(localStorage.getItem("theme"));
});

repeatToggle.addEventListener('change', () => {
    if (!repeatToggle.checked) {
        handleClearInterval();
    }
});