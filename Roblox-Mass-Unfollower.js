// ==UserScript==
// @name         Roblox Mass Unfollower (Dashboard Edition)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automated bulk unfollower for Roblox with dashboard stats and safety delays.
// @author       [YourUsername]
// @match        https://www.roblox.com/*
// @grant        none
// ==/UserScript==

(async () => {
    'use strict';

    // --- CONFIGURATION ---
    const DELAY_MS = 1500; // 1.5s is safe. Lowering this risks a 429 Timeout.
    const BATCH_SIZE = 100; // Roblox API limit per request.

    // --- HELPERS ---
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}m ${s}s`;
    };

    console.clear();
    console.log("%c🚀 Roblox Unfollower Loaded", "color: #00ff00; font-size: 20px; font-weight: bold;");
    console.log("To start, stay on this tab and let the script run.");

    try {
        // 1. SETUP
        const userData = document.querySelector('meta[name="user-data"]');
        if (!userData) {
            console.error("❌ User data not found. Make sure you are logged in and on a Roblox page.");
            return;
        }
        const userId = userData.dataset.userid;
        let csrfToken = document.querySelector('meta[name="csrf-token"]').content;

        let totalRemoved = 0;
        let batchCount = 0;

        while (true) {
            // 2. FETCH LIST
            console.log(`\n📥 Fetching next batch...`);
            const listUrl = `https://friends.roblox.com/v1/users/${userId}/followings?sortOrder=Desc&limit=${BATCH_SIZE}`;
            
            // Credentials 'include' is vital for cross-subdomain auth
            const listRes = await fetch(listUrl, { credentials: 'include' });
            
            if (!listRes.ok) {
                console.warn("⚠️ Error fetching list. Retrying in 5s...");
                await sleep(5000);
                continue;
            }

            const data = await listRes.json();
            const following = data.data;

            // 3. EXIT CONDITION
            if (!following || following.length === 0) {
                console.log(`\n🎉 DONE! Total removed: ${totalRemoved}`);
                console.log("%cRefresh your page to see the changes.", "color: #00ff00; font-weight: bold;");
                break;
            }

            // Stats
            const remainingInBatch = following.length;
            const estTime = (remainingInBatch * (DELAY_MS/1000)); 
            
            console.log(`📊 Batch #${batchCount + 1} | Users: ${remainingInBatch} | Est. Wait: ~${formatTime(estTime)}`);

            // 4. UNFOLLOW LOOP
            for (const user of following) {
                const unfollowUrl = `https://friends.roblox.com/v1/users/${user.id}/unfollow`;
                
                const tryUnfollow = async (token) => {
                    return await fetch(unfollowUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
                        credentials: 'include'
                    });
                };

                let res = await tryUnfollow(csrfToken);

                // Token Refresh Logic (Fixes 403 Errors)
                if (res.status === 403) {
                    console.log("🔄 Refreshing token...");
                    const newToken = res.headers.get('x-csrf-token');
                    if (newToken) {
                        csrfToken = newToken;
                        res = await tryUnfollow(csrfToken);
                    }
                }

                if (res.ok) {
                    totalRemoved++;
                    console.log(`✅ [${totalRemoved}] Unfollowed: ${user.name || user.displayName || "User"}`);
                } else {
                    console.warn(`❌ Failed: ${user.name} (Status: ${res.status})`);
                    if (res.status === 429) {
                        console.log("🛑 Rate Limit. Pausing 30s...");
                        await sleep(30000);
                    }
                }

                await sleep(DELAY_MS);
            }
            batchCount++;
        }
    } catch (err) {
        console.error("❌ Fatal Error:", err);
    }
})();