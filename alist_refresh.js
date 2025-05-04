// alist_refresh.js

let script = document.createElement('script');
script.src = 'https://cnicehs.github.io/Aria/rclone.umd.min.js';
script.type = 'text/javascript';
document.head.appendChild(script);


// --- Configuration Keys for localStorage ---
const CONFIG_KEYS = {
    baseUrl: 'alistRefresh_baseUrl',
    token: 'alistRefresh_token',
    rclonePassword: 'alistRefresh_rclonePassword',
    rcloneSalt: 'alistRefresh_rcloneSalt',
    crypt: 'cryptpath',
    cryptraw: 'cryptpathraw',
    encode: 'cryptencode',
};

// --- Global Config Object ---
// Populated by initializeAlistRefresh()
const config = {
    baseUrl: null,
    token: null,
    rclonePassword: null,
    rcloneSalt: null,
    crypt: null,
    cryptraw: null,
    cryptraw: null,
    encode: null,
};

let refresh_btn;

/**
 * Gets a configuration value from localStorage or prompts the user.
 * @param {string} key - The key in localStorage (use CONFIG_KEYS).
 * @param {string} promptMessage - The message to show the user if the value is missing.
 * @param {boolean} isSensitive - If true, use a password-type prompt (though prompt doesn't hide input).
 * @returns {string|null} The value or null if prompt was cancelled.
 */
function getConfig(key, promptMessage, isSensitive = false) {
    let value = localStorage.getItem(key);
    if (!value) {
        // Note: prompt() doesn't actually hide input like a password field
        value = prompt(promptMessage);
        if (value) {
            localStorage.setItem(key, value);
            console.log(`Alist Refresh: Saved ${key} to localStorage.`);
        } else {
            if (isSensitive) {
                throw `Alist Refresh: User cancelled or provided no input for ${key}.`
            }
            console.error(`Alist Refresh: User cancelled or provided no input for ${key}.`);
            // alert(`Configuration for ${promptMessage.split(':')[0]} is required.`);
            return null; // Indicate failure
        }
    }
    return value;
}


// Helper to get the logical Alist path from the URL
function getCurrentAlistPath() {
    let path = decodeURIComponent(window.location.pathname); // Decode URL-encoded chars like spaces
    // Remove potential Alist prefixes like /@/ /#/ /dav/ etc.
    // This regex tries to match common patterns at the start
    path = path.replace(/^\/(@|#|dav)\//, '/');
    // Ensure it starts with a slash, remove trailing slash unless it's the root
    path = '/' + path.replace(/^\//, '');
    if (path !== '/' && path.endsWith('/')) {
        path = path.slice(0, -1);
    }
    return path; // e.g., "/crypt/my folder"
}

/**
 * Calls the Alist API to refresh a given path using stored config.
 * @param {string} encryptedPath - The encrypted path in Alist.
 */
async function refreshAlistPath(curPath) {
    // Ensure config is loaded (should be by initializeAlistRefresh)
    if (!config.baseUrl || !config.token) {
        alert("Alist URL or Token is not configured. Please reload and enter the details.");
        return;
    }

    if (!curPath) {
        console.error("Alist Refresh: No path provided by getCurrentAlistPathFromPage().");
        alert("Error: Could not determine the path to refresh from the page.");
        return;
    }

    // Rclone creds are still optional
    config.rclonePassword = getConfig(CONFIG_KEYS.rclonePassword, 'Enter your Rclone Crypt Password:', true);
    config.rcloneSalt = getConfig(CONFIG_KEYS.rcloneSalt, 'Enter your Rclone Crypt Salt:', true);
    config.encode = getConfig(CONFIG_KEYS.encode, 'Enter your Rclone Crypt encode base64:', true);

    curPath = curPath.replace(config.crypt, "")
    if (curPath.startsWith("/")) {
        curPath = curPath.replace("/", "")
    }
    const rclone = await window.rclone.Rclone({
        password: config.rclonePassword, salt: config.rcloneSalt, encoding: config.encode
    });

    let target_path = config.cryptraw;
    if (curPath != "") {
        const encryptedPath = rclone.Path.encrypt(curPath)
        target_path = target_path + "/" + encryptedPath
    }

    console.log(`Alist Refresh: Attempting to refresh path: ${target_path}, curPath ${curPath}`);
    const apiUrl = `${config.baseUrl}/api/fs/list`;
    const headers = new Headers();
    headers.append("Authorization", config.token);
    headers.append("Content-Type", "application/json");

    const body = JSON.stringify({
        path: target_path,
        password: "",
        page: 1,
        per_page: 0,
        refresh: true
    });

    const requestOptions = {
        method: 'POST',
        headers: headers,
        body: body,
        redirect: 'follow'
    };

    try {
        const response = await fetch(apiUrl, requestOptions);
        const resultText = await response.text();

        if (!response.ok) {
            let errorDetails = resultText;
            try {
                const errorJson = JSON.parse(resultText);
                errorDetails = errorJson.message || JSON.stringify(errorJson);
            } catch (e) { /* Ignore */ }
            console.error(`Alist Refresh Error: ${response.status} ${response.statusText}. Details: ${errorDetails}`);
            // alert(`Error refreshing path ${target_path}: ${errorDetails}`);
        } else {
            console.log(`Alist Refresh: Successfully requested refresh for ${target_path}. Response:`, resultText);
            // alert(`Refresh requested for: ${target_path}`);
            document.querySelector('[tips="refresh"]').dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            }));
        }
    } catch (error) {
        console.error('Alist Refresh: Network or fetch error:', error);
        // alert(`Failed to send refresh request for ${target_path}. Check console (CORS?).`);
    }
}

/**
 * Adds a refresh button fixed to the middle-right of the screen.
 */
function addFixedRefreshButton() {
    // Check if button already exists
    if (document.getElementById('alist-refresh-fixed-button')) {
        console.log("Alist Refresh: Button already exists.");
        return;
    }

    const button = document.createElement('button');
    button.id = 'alist-refresh-fixed-button';
    button.textContent = '🔄';
    // Styling for fixed position
    button.style.position = 'fixed';
    button.style.right = '20px';
    button.style.top = '50%';
    button.style.transform = 'translateY(-50%)';
    button.style.zIndex = '9999'; // Ensure it's on top
    button.style.padding = '10px 15px';
    button.style.cursor = 'pointer';
    button.style.backgroundColor = '#4CAF50'; // Green
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

    button.onclick = () => {
        const currentPath = getCurrentAlistPath();
        if (currentPath) {
            refreshAlistPath(currentPath);
        } else {
            // Error already alerted by refreshAlistPath if path is null/empty
            console.log("Alist Refresh: Button clicked, but no path obtained from getCurrentAlistPathFromPage.");
        }
    };

    document.body.appendChild(button);
    console.log("Alist Refresh: Fixed refresh button added to page.");
    refresh_btn = button;
}

/**
 * Initializes the script: gets config and adds the button.
 */
function initializeAlistRefresh() {
    console.log("Alist Refresh: Initializing...");

    // Automatically set baseUrl to current origin
    config.baseUrl = window.location.origin;
    console.log(`Alist Refresh: Auto-detected baseUrl as ${config.baseUrl}`);

    // Automatically get token from localStorage
    config.token = localStorage.getItem("token");
    if (!config.token) {
        alert("Alist API Token not found in localStorage (key: 'token'). Please login first.");
        return;
    }
    console.log("Alist Refresh: Token successfully retrieved from localStorage.");

    config.crypt = getConfig(CONFIG_KEYS.crypt, `Enter the Alist UI Mount Path for the Crypt Storage (e.g., /crypt). It cannot be root '/'.`, true);
    config.cryptraw = getConfig(CONFIG_KEYS.cryptraw, `Enter the Base Path on the Raw/Real Storage corresponding to ${config.crypt} (e.g., /real_files or /):`, true);

    // Add the button to the page
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addFixedRefreshButton);
    } else {
        addFixedRefreshButton();
    }

    console.log("Alist Refresh: Initialization complete.");
}

function update() {
    if (!refresh_btn) {
        return
    }
    if (getCurrentAlistPath().startsWith(config.crypt)) {
        refresh_btn.style.display = 'block';
    } else {
        refresh_btn.style.display = 'none';
    }
}

// --- Start Execution ---
initializeAlistRefresh();

// Use MutationObserver to detect page changes (SPA navigation)
const observer = new MutationObserver(function (mutations) {
    // Use requestAnimationFrame to avoid layout thrashing and wait for potential DOM updates
    window.requestAnimationFrame(() => {
        // Check if the button should be added/removed based on the new path
        update();
    });
});

// Observe the body for child additions/removals and subtree changes.
// Avoid observing attributes unless necessary, as it can be noisy.
observer.observe(document, { childList: true, subtree: true });

console.log("alist_refresh.js evaluation complete.");