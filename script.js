let zones = [];
let popularityData = {};
const featuredContainer = document.getElementById('featuredZones');
let isSiteLocked = true; // <-- NEW: Flag for password lock
let currentFilter = 'all';

// --- Utility Functions (Existing) ---

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function showPopup(title, content, showClose = true) {
    document.getElementById('popupTitle').textContent = title;
    document.getElementById('popupBody').innerHTML = content;
    document.getElementById('popupOverlay').style.display = 'flex';
    document.getElementById('popupClose').style.display = showClose ? 'flex' : 'none';
}

function closePopup() {
    document.getElementById('popupOverlay').style.display = 'none';
}

// --- New Password Functions (NEW) ---

/**
 * Calculates a predictable, week-based password.
 * The password is based on the current year and the current week number (ISO standard).
 * This ensures the password changes predictably every Monday.
 * @returns {string} The weekly password (e.g., '2025-50').
 */
function getWeeklyPassword() {
    const now = new Date();

    // ISO 8601 Week Number Calculation: 
    // This reliably ensures the week resets on Monday.
    const date = new Date(now.valueOf());
    date.setDate(date.getDate() + 4 - (date.getDay() || 7)); // Set to Thursday
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    
    const year = now.getFullYear();
    // Format: YYYY-WW (e.g., 2025-50)
    return `${year}-${weekNumber}`; 
}

/**
 * Displays the password prompt and handles validation.
 */
function showPasswordPrompt() {
    const correctPassword = getWeeklyPassword();
    
    document.getElementById('popupTitle').textContent = "Access Required";
    document.getElementById('popupClose').style.display = 'none'; // Lock the close button
    const popupBody = document.getElementById('popupBody');
    
    popupBody.innerHTML = `
        <p style="font-weight: 500; color: var(--text-muted);">
            This site is protected by a weekly code that changes every Monday.
        </p>
        <input type="password" id="passwordInput" placeholder="Enter Code Here..." autofocus>
        <button id="submitPassword" class="settings-button" style="margin-top: 10px; width: 100%;">
            Unlock Site
        </button>
        <p id="passwordError" style="color: var(--primary); font-weight: 600; margin-top: 10px; display: none;">
            Incorrect Code. Please try again.
        </p>
    `;

    document.getElementById('popupOverlay').style.display = "flex";

    const passwordInput = document.getElementById('passwordInput');
    const submitButton = document.getElementById('submitPassword');
    const errorMsg = document.getElementById('passwordError');

    const validateAndUnlock = () => {
        const enteredPassword = passwordInput.value.trim();
        if (enteredPassword === correctPassword) {
            // Success: Set flag and unlock content
            isSiteLocked = false;
            sessionStorage.setItem('site_unlocked', 'true');
            sessionStorage.setItem('last_password', correctPassword);
            closePopup(); 
            document.querySelector('main').style.filter = 'none';
            document.querySelector('footer').style.filter = 'none';
            listZones(); // Reload/Start listing the content
        } else {
            errorMsg.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
        }
    };

    submitButton.onclick = validateAndUnlock;
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            validateAndUnlock();
        }
    });
}


// --- Core Data Fetching and Display (Modified) ---

async function listZones() {
    if (isSiteLocked) {
        // NEW: Do not proceed if the site is locked
        return; 
    }
    
    const container = document.getElementById('container');
    container.innerHTML = '';
    document.getElementById('zoneCount').textContent = 'Loading zones...';

    try {
        // Use GitHub API to get the latest commit SHA for version control
        let sharesponse = await fetch('https://api.github.com/repos/gn-math/assets/commits');
        let shadata = await sharesponse.json();
        let latestSha = shadata[0].sha;

        // Fetch zones.json using the latest SHA to bypass CDN caching
        let zonesResponse = await fetch(`https://cdn.jsdelivr.net/gh/gn-math/assets@${latestSha}/zones.json`);
        zones = await zonesResponse.json();

        // Fetch popularity data
        let popularityResponse = await fetch(`https://cdn.jsdelivr.net/gh/gn-math/assets@${latestSha}/popularity.json`);
        popularityData = await popularityResponse.json();

        // Process zones data
        zones.forEach(zone => {
            zone.popularity = popularityData[zone.id] || 0;
            zone.tags = zone.tags || [];
        });

        // Apply Search and Filter
        const searchTerm = document.getElementById('searchBar').value.toLowerCase();
        let filteredZones = zones.filter(zone => {
            const matchesSearch = zone.name.toLowerCase().includes(searchTerm) ||
                                  zone.author.toLowerCase().includes(searchTerm) ||
                                  zone.id.toLowerCase().includes(searchTerm);
            
            const matchesFilter = currentFilter === 'all' || zone.tags.includes(currentFilter);

            return matchesSearch && matchesFilter;
        });

        // Apply Sort
        const sortOption = document.getElementById('sortOptions').value;
        filteredZones.sort((a, b) => {
            if (sortOption === 'name-asc') return a.name.localeCompare(b.name);
            if (sortOption === 'name-desc') return b.name.localeCompare(a.name);
            if (sortOption === 'popularity') return b.popularity - a.popularity;
            if (sortOption === 'newest') return b.id - a.id; // Assuming higher ID means newer
            return 0;
        });

        // Display Featured (Top 5 Popularity)
        const featuredZones = filteredZones
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 5);
        
        featuredContainer.innerHTML = '';
        featuredZones.forEach(zone => {
            featuredContainer.appendChild(createZoneElement(zone));
        });


        // Display Main List (excluding featured)
        const mainZones = filteredZones.filter(zone => !featuredZones.includes(zone));
        mainZones.forEach(zone => {
            container.appendChild(createZoneElement(zone));
        });

        document.getElementById('zoneCount').textContent = `${mainZones.length + featuredZones.length} Zones Available`;

        // Update Filter Options (Existing Logic)
        const filterOptions = document.getElementById('filterOptions');
        filterOptions.innerHTML = '<option value="all">All Tags</option>';

        let alltags = new Set();
        zones.forEach(zone => zone.tags.forEach(tag => alltags.add(tag)));

        for (const tag of alltags) {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = capitalizeFirstLetter(tag);
            if (tag === currentFilter) {
                option.selected = true;
            }
            filterOptions.appendChild(option);
        }

    } catch (error) {
        console.error('Error fetching or processing zones:', error);
        document.getElementById('zoneCount').textContent = 'Error loading zones. Please try again.';
    }
}

function createZoneElement(zone) {
    const item = document.createElement('div');
    item.className = 'zone-item';
    
    // Check if the image path is available, otherwise use a fallback
    const imagePath = zone.image ? `https://cdn.jsdelivr.net/gh/gn-math/assets/images/${zone.image}` : 'placeholder.png';

    item.innerHTML = `
        <img src="${imagePath}" alt="${zone.name} Thumbnail" loading="lazy">
        <button data-id="${zone.id}" data-name="${zone.name}" data-author="${zone.author}" data-url="${zone.url}">
            ${zone.name}
            ${zone.popularity > 0 ? `<br><small style="color: var(--text-light); font-weight: 400;">(Plays: ${zone.popularity.toLocaleString()})</small>` : ''}
        </button>
    `;

    item.querySelector('button').addEventListener('click', () => openZoneViewer(zone));
    return item;
}

function openZoneViewer(zone) {
    document.getElementById('zoneName').textContent = zone.name;
    document.getElementById('zoneAuthor').textContent = `by ${zone.author || 'Unknown'}`;
    document.getElementById('zoneAuthor').href = zone.authorUrl || '#';
    document.getElementById('zoneId').textContent = zone.id;
    
    // IMPORTANT: Use about:blank to bypass school filters and load content securely
    const url = new URL(zone.url);
    const frameSrc = `about:blank`;
    
    document.getElementById('zoneFrame').src = frameSrc;
    document.getElementById('zoneViewer').style.display = 'flex';
    
    // Wait for the iframe to load, then inject the actual content
    document.getElementById('zoneFrame').onload = () => {
        const iframe = document.getElementById('zoneFrame');
        if (iframe.contentWindow) {
            iframe.contentWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${zone.name}</title>
                    <style>body { margin: 0; overflow: hidden; background: #000; }</style>
                </head>
                <body>
                    <iframe src="${zone.url}" style="width: 100%; height: 100vh; border: none; margin: 0;" allow="fullscreen; geolocation; microphone; camera; midi; encrypted-media;"></iframe>
                </body>
                </html>
            `);
            iframe.contentWindow.document.close();
            
            // Re-center the viewer content
            document.getElementById('zoneFrame').style.width = '100%';
            document.getElementById('zoneFrame').style.height = '100%';
        }
    };
}


// --- Event Listeners and Initialization (Modified) ---

function initEventListeners() {
    document.getElementById('searchBar').addEventListener('input', listZones);
    document.getElementById('sortOptions').addEventListener('change', listZones);
    
    document.getElementById('filterOptions').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        listZones();
    });

    document.getElementById('closeZoneViewer').addEventListener('click', () => {
        document.getElementById('zoneViewer').style.display = 'none';
        document.getElementById('zoneFrame').src = 'about:blank'; // Clear iframe content
    });

    document.getElementById('settingsButton').addEventListener('click', () => {
        showPopup('Settings', 'Settings content to be implemented here (e.g., toggle dark mode, clear cache, change tab cloak).');
    });
    
    document.getElementById('darkModeToggle').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        // Save state to local storage
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });

    // Apply saved theme on load
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }
    
    // NEW: Allow the popup close button to work ONLY if the site is unlocked
    document.getElementById('popupClose').onclick = () => {
        if (!isSiteLocked) {
            closePopup();
        }
    };
}


// --- Tab Cloaking (Existing) ---

function tabCloak(title, icon) {
    document.title = title;
    document.querySelector('link[rel="icon"]').href = icon;
}

// --- Initial Load Sequence (Corrected for Execution Order) ---

function initializeSite() {
    // 1. Set up all event listeners for the site controls
    initEventListeners();
    
    // 2. Password Check Logic
    const mainContent = document.querySelector('main');
    const footerContent = document.querySelector('footer');
    const currentPassword = getWeeklyPassword();
    const lastUnlockedPassword = sessionStorage.getItem('last_password');
    const isUnlocked = sessionStorage.getItem('site_unlocked') === 'true';

    // A. Check if the site was already unlocked with the current week's password
    if (isUnlocked && currentPassword === lastUnlockedPassword) {
        // User is logged in for this week's code
        isSiteLocked = false;
        mainContent.style.filter = 'none';
        if (footerContent) footerContent.style.filter = 'none';
        // 3. Load the game content
        listZones(); 
    } else {
        // B. Force password prompt
        isSiteLocked = true;
        
        // Clear old session data and store the current week's password
        sessionStorage.removeItem('site_unlocked');
        sessionStorage.setItem('last_password', currentPassword); 
        
        // Visually obscure the content
        mainContent.style.filter = 'blur(10px)'; 
        if (footerContent) footerContent.style.filter = 'blur(10px)';
        
        // Show the prompt
        showPasswordPrompt();
        
        // We still call listZones, but it will exit immediately because isSiteLocked is true.
        listZones(); 
    }
}

// Start the entire process ONLY after the DOM is ready to prevent errors
document.addEventListener('DOMContentLoaded', initializeSite);
