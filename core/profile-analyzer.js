/**
 * ProfileAnalyzer - Extracts structured profile data from LinkedIn profile DOM
 * 
 * ANTI-BAN COMPLIANCE:
 * - Only reads visible DOM elements
 * - No API calls or network requests
 * - Works only on the current profile page
 */

class ProfileAnalyzer {
    /**
     * Analyze the LinkedIn profile page and extract relevant information
     * @param {Element} profileRootElement - The root element of the profile (usually document.body)
     * @returns {Object} Structured profile data
     */
    static analyze(profileRootElement = document.body) {
        const profileId = this.extractProfileId();
        const name = this.extractName(profileRootElement);
        const headline = this.extractHeadline(profileRootElement);
        const company = this.extractCurrentCompany(profileRootElement);
        const recentActivities = this.extractRecentActivities(profileRootElement);
        const experience = this.extractExperience(profileRootElement);
        const featuredHighlight = this.extractFeaturedHighlight(profileRootElement);
        const profilePhoto = this.extractProfilePhoto(profileRootElement);
        const about = this.extractAbout(profileRootElement);

        return {
            profileId,
            name,
            headline,
            company,
            recentActivities,
            experience,
            featuredHighlight,
            profilePhoto,
            about,
            extractedAt: new Date().toISOString()
        };
    }

    /**
     * Extract profile ID from the current URL
     * @returns {string} Profile ID or empty string
     */
    static extractProfileId() {
        try {
            const url = window.location.href;
            const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
            return match ? match[1] : '';
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting profile ID:', e);
            return '';
        }
    }

    /**
     * Extract the person's name from the profile
     * @param {Element} root - Root element to search within
     * @returns {string} Name or empty string
     */
    static extractName(root) {
        try {
            // 1. Specific LinkedIn profile name selectors (highest priority)
            const selectors = [
                '.text-heading-xlarge',
                '.pv-top-card--list h1',
                '.pv-top-card h1',
                '[data-anonymize="person-name"]',
                '.ph5 h1',
                'main h1',
                'h1.inline'
            ];

            for (const selector of selectors) {
                const el = root.querySelector(selector);
                if (el && el.textContent) {
                    let text = el.textContent.trim();
                    // Clean up badges / pronouns / status lines
                    text = text.split('\n')[0].replace(/·.*$/, '').replace(/\(.*\)/, '').trim();
                    if (text && !['linkedin', 'feed', 'search', 'jobs', 'messaging', 'notifications'].includes(text.toLowerCase())) {
                        return text;
                    }
                }
            }

            // 2. Scan all h1 elements for valid name
            const allH1s = root.querySelectorAll('h1');
            for (const h1 of allH1s) {
                if (h1 && h1.textContent) {
                    let text = h1.textContent.trim();
                    text = text.split('\n')[0].replace(/·.*$/, '').replace(/\(.*\)/, '').trim();
                    if (text && !['linkedin', 'feed', 'search', 'jobs', 'messaging', 'notifications'].includes(text.toLowerCase())) {
                        return text;
                    }
                }
            }

            // 3. Guaranteed Fallback: Parse document.title
            if (typeof document !== 'undefined' && document.title) {
                let title = document.title;
                // e.g., "Satya Nadella | LinkedIn" or "Bill Gates - Chairman | LinkedIn"
                title = title.split('|')[0].split('-')[0].trim();
                if (title && !['linkedin', 'feed', 'search', 'jobs', 'messaging', 'notifications'].includes(title.toLowerCase())) {
                    return title;
                }
            }

            return '';
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting name:', e);
            return '';
        }
    }

    /**
     * Extract the headline/title from the profile
     * @param {Element} root - Root element to search within
     * @returns {string} Headline or empty string
     */
    static extractHeadline(root) {
        try {
            const selectors = [
                '.pv-top-card .text-body-medium',
                '.pv-text-details__left-panel .text-body-medium',
                '.text-body-medium[data-anonymize="headline"]',
                '.text-body-medium',
                '.pv-top-card--list + div'
            ];

            for (const selector of selectors) {
                const el = root.querySelector(selector);
                if (el && el.textContent) {
                    const text = el.textContent.trim();
                    if (text && text.length > 3) {
                        return text;
                    }
                }
            }

            return '';
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting headline:', e);
            return '';
        }
    }

    /**
     * Extract current company/role from experience section
     * @param {Element} root - Root element to search within
     * @returns {string} Company/role or empty string
     */
    static extractCurrentCompany(root) {
        try {
            // Try to find experience section
            const experienceSection = root.querySelector('#experience') ||
                root.querySelector('[id*="experience"]') ||
                root.querySelector('section[data-section="experience"]');

            if (experienceSection) {
                // Look for the first experience item
                const firstExperience = experienceSection.querySelector('li') ||
                    experienceSection.querySelector('.pvs-entity');

                if (firstExperience) {
                    // Try to get company name and role
                    const roleElement = firstExperience.querySelector('.t-bold span[aria-hidden="true"]') ||
                        firstExperience.querySelector('.mr1.t-bold span');
                    const companyElement = firstExperience.querySelector('.t-normal span[aria-hidden="true"]') ||
                        firstExperience.querySelector('.t-14.t-normal span');

                    const role = roleElement ? roleElement.textContent.trim() : '';
                    const company = companyElement ? companyElement.textContent.trim() : '';

                    if (role && company) {
                        return `${role} at ${company}`;
                    } else if (role) {
                        return role;
                    } else if (company) {
                        return company;
                    }
                }
            }

            // Fallback: Look for company in the profile header
            const companyLink = root.querySelector('button[aria-label*="Current company"]') ||
                root.querySelector('[data-field="experience_company"]');
            if (companyLink) {
                return companyLink.textContent.trim();
            }

            return '';
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting company:', e);
            return '';
        }
    }

    /**
     * Extract recent activity snippet (post/comment)
     * @param {Element} root - Root element to search within
     * @returns {string} Activity snippet or empty string
     */
    /**
     * Extract recent activity posts (up to 3)
     * @param {Element} root - Root element to search within
     * @returns {string[]} Array of activity post strings
     */
    static extractRecentActivities(root) {
        try {
            const posts = [];
            const processedTexts = new Set(); // To avoid duplicates

            // Helper: extract posts from a container
            const extractPostsFromContainer = (container) => {
                if (!container) return;

                // Strategy: Look for individual activity cards/items
                // Usually list items in the activity section
                const items = container.querySelectorAll('li.pvs-list__paged-list-item, .profile-creator-shared-feed-update__container');

                // If no list items found, try the whole container's text nodes (fallback)
                if (items.length === 0) {
                    // Use the previous logic for single post extraction as a fallback
                    // ... but adapted to find multiple text blocks? 
                    // Actually, if we can't find list items, we might just look for text blocks
                    const candidates = container.querySelectorAll(
                        'span[dir="ltr"], .break-words, .feed-shared-text, ' +
                        '.update-components-text, span[aria-hidden="true"], a[aria-label], img[alt]'
                    );

                    const profileName = (root.querySelector('h1') || {}).textContent?.trim() || '';
                    const nameParts = profileName.toLowerCase().split(/\s+/);

                    for (const el of candidates) {
                        if (posts.length >= 3) break;

                        let text = el.textContent?.trim() || el.getAttribute('aria-label') || el.alt || '';
                        if (!text) continue;

                        // Clean up
                        text = text.trim();

                        // Filters
                        if (text.length < 10 || text.length > 2000) continue;
                        if (processedTexts.has(text)) continue;

                        // Skip if name only
                        const lowerText = text.toLowerCase();
                        if (nameParts.length > 0 && nameParts.every(part => lowerText.includes(part)) && text.length < profileName.length * 3) continue;

                        // Skip timestamps, "show all", etc.
                        // Skip timestamps, "show all", etc.
                        if (/^\d+[dhwm]\s*[·•]?\s*$/i.test(text)) continue;
                        if (/show all/i.test(text)) continue;
                        // if (/commented on this/i.test(text)) continue;

                        posts.push(text);
                        processedTexts.add(text);
                    }
                    return;
                }

                // Process identified list items
                for (const item of items) {
                    if (posts.length >= 3) break;

                    // Try to find the post text within this item
                    const textCandidates = item.querySelectorAll(
                        'span[dir="ltr"], .break-words, .feed-shared-text, ' +
                        '.update-components-text'
                    );

                    let bestText = '';
                    for (const cand of textCandidates) {
                        const txt = cand.textContent.trim();
                        if (txt.length > 10) {
                            bestText = txt;
                            break;
                        }
                    }

                    // Fallback to aria-label on links
                    if (!bestText) {
                        const link = item.querySelector('a[aria-label]');
                        if (link) {
                            const label = link.getAttribute('aria-label');
                            if (label && label.length > 10 && !/show all/i.test(label)) {
                                bestText = label;
                            }
                        }
                    }

                    // Fallback to image alt
                    if (!bestText) {
                        const img = item.querySelector('img[alt]');
                        if (img && img.alt.length > 30) bestText = img.alt;
                    }

                    if (bestText && !processedTexts.has(bestText)) {
                        posts.push(bestText);
                        processedTexts.add(bestText);
                    }
                }
            };

            // 1. Find the main activity section
            const activitySection = root.querySelector('#recent-activity') ||
                root.querySelector('div.pvs-recent-activity') ||
                root.querySelector('[id*="recent-activity"]') ||
                root.querySelector('section[data-section="activity"]') ||
                root.querySelector('.pv-recent-activity-section');

            if (activitySection) {
                extractPostsFromContainer(activitySection);
            }

            // 2. Fallback: Scan headers if no posts found yet
            if (posts.length === 0) {
                const allSections = root.querySelectorAll('section');
                for (const section of allSections) {
                    const header = section.querySelector('h2, .pvs-header__title span[aria-hidden="true"]');
                    if (header && /activity/i.test(header.textContent)) {
                        extractPostsFromContainer(section);
                        if (posts.length > 0) break;
                    }
                }
            }

            return posts;
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting recent activity:', e);
            return [];
        }
    }

    /**
     * Extract experience entries (Role, Company, Duration)
     * @param {Element} root - Root element
     * @returns {string[]} Array of strings describing top 3 experiences
     */
    static extractExperience(root) {
        try {
            const experiences = [];

            // Find Experience Section
            const expSection = root.querySelector('#experience') ||
                root.querySelector('[id*="experience"]') ||
                root.querySelector('section[data-section="experience"]');

            if (expSection) {
                // Get the list items. Usually .pvs-list__paged-list-item
                // Or look for any LI inside the section's list
                const listItems = expSection.querySelectorAll('li.pvs-list__paged-list-item, li.artdeco-list__item');

                for (const item of listItems) {
                    if (experiences.length >= 3) break;

                    // Extract Role (usually bold)
                    const roleEl = item.querySelector('.t-bold span[aria-hidden="true"]') || item.querySelector('h3 span[aria-hidden="true"]');
                    // Extract Company (usually normal text)
                    const companyEl = item.querySelector('.t-normal span[aria-hidden="true"]') || item.querySelector('h4 span[aria-hidden="true"]');
                    // Extract Duration/Location (usually secondary text)
                    const metaEl = item.querySelector('.t-14.t-normal--light span[aria-hidden="true"]') || item.querySelector('.pv-entity__date-range span:nth-child(2)');

                    const role = roleEl ? roleEl.textContent.trim() : '';
                    const company = companyEl ? companyEl.textContent.trim() : '';
                    const meta = metaEl ? metaEl.textContent.trim() : '';

                    if (role || company) {
                        const parts = [role, company, meta].filter(p => p).join(' at '); // Simple join
                        experiences.push(`${role} at ${company} ${meta ? '(' + meta + ')' : ''}`);
                    }
                }
            }

            return experiences;
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting experience:', e);
            return [];
        }
    }

    /**
     * Extract featured achievements/highlights
     * @param {Element} root - Root element to search within
     * @returns {string} Featured highlight or empty string
     */
    static extractFeaturedHighlight(root) {
        try {
            // Look for featured section
            const featuredSection = root.querySelector('#featured') ||
                root.querySelector('[id*="featured"]') ||
                root.querySelector('section[data-section="featured"]') ||
                root.querySelector('.pv-featured-section');

            if (featuredSection) {
                // Look for featured item title or description
                const featuredTitle = featuredSection.querySelector('.t-bold span[aria-hidden="true"]') ||
                    featuredSection.querySelector('.pv-featured-section__title') ||
                    featuredSection.querySelector('h3');

                if (featuredTitle && featuredTitle.textContent) {
                    return featuredTitle.textContent.trim();
                }

                // Look for any descriptive text
                const featuredDesc = featuredSection.querySelector('.t-normal span[aria-hidden="true"]') ||
                    featuredSection.querySelector('p');
                if (featuredDesc && featuredDesc.textContent) {
                    return featuredDesc.textContent.trim().substring(0, 150);
                }
            }

            return '';
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting featured highlight:', e);
            return '';
        }
    }

    /**
     * Validate that we have enough context to generate a meaningful message
     * @param {Object} profileData - The extracted profile data
     * @returns {boolean} True if we have minimum required data
     */
    static hasMinimumContext(profileData) {
        return !!(profileData.name && (profileData.headline || profileData.company));
    }

    /**
     * Extract profile photo URL
     * @param {Element} root - Root element to search within
     * @returns {string} Profile photo URL or empty string
     */
    static extractProfilePhoto(root) {
        try {
            // Primary: Profile photo in the main hero section
            const heroImg = root.querySelector('.pv-top-card-profile-picture__image--show') ||
                root.querySelector('img.pv-top-card-profile-picture__image') ||
                root.querySelector('.presence-entity__image') ||
                root.querySelector('img[data-anonymous="person-photo"]');

            if (heroImg && heroImg.src && !heroImg.src.includes('ghost')) {
                return heroImg.src;
            }

            // Fallback: any img with profile-like alt text
            const allImgs = root.querySelectorAll('img');
            for (const img of allImgs) {
                const alt = (img.alt || '').toLowerCase();
                if (alt && img.src && !img.src.includes('ghost') &&
                    img.width > 80 && img.height > 80 &&
                    (alt.includes('photo') || alt.includes('profile'))) {
                    return img.src;
                }
            }

            return '';
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting profile photo:', e);
            return '';
        }
    }

    /**
     * Extract about/summary section
     * @param {Element} root - Root element to search within
     * @returns {string} About text or empty string
     */
    static extractAbout(root) {
        try {
            // Look for About section by header text
            const allSections = root.querySelectorAll('section');
            for (const section of allSections) {
                const header = section.querySelector('h2, .pvs-header__title span[aria-hidden="true"]');
                if (header && /about/i.test(header.textContent)) {
                    // Get the header's parent to exclude it from content search
                    const headerContainer = header.closest('.pvs-header__container') ||
                        header.closest('.pvs-header') ||
                        header.parentElement;

                    // Look for actual about content — must NOT be inside the header
                    const contentCandidates = section.querySelectorAll(
                        '.inline-show-more-text span[aria-hidden="true"], ' +
                        '.pv-shared-text-with-see-more span[aria-hidden="true"], ' +
                        'div.display-flex span[aria-hidden="true"], ' +
                        'span.visually-hidden'
                    );

                    for (const candidate of contentCandidates) {
                        // Skip if this element is inside the header
                        if (headerContainer && headerContainer.contains(candidate)) continue;
                        const text = candidate.textContent.trim();
                        // Skip very short content and skip if it just says "About"
                        if (text.length > 10 && !/^about$/i.test(text)) {
                            return text;
                        }
                    }

                    // Broader fallback: get all text from the section minus the header
                    const clone = section.cloneNode(true);
                    const headerClone = clone.querySelector('h2, .pvs-header__title');
                    if (headerClone) headerClone.closest('.pvs-header__container, .pvs-header, div')?.remove();
                    // Also remove any "Show more" / "Show less" buttons
                    clone.querySelectorAll('button').forEach(b => b.remove());
                    const remaining = clone.textContent.trim();
                    if (remaining.length > 20 && !/^about$/i.test(remaining)) {
                        return remaining.substring(0, 500);
                    }
                }
            }

            // Fallback: legacy selector
            const aboutSection = root.querySelector('#about') ||
                root.querySelector('section[data-section="summary"]');
            if (aboutSection) {
                const text = aboutSection.querySelector('.inline-show-more-text span[aria-hidden="true"]') ||
                    aboutSection.querySelector('.pv-about__summary-text span');
                if (text && text.textContent && text.textContent.trim().length > 10) {
                    return text.textContent.trim();
                }
            }

            return '';
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting about:', e);
            return '';
        }
    }
}

// Export for use in content scripts
if (typeof window !== 'undefined') {
    window.ProfileAnalyzer = ProfileAnalyzer;
}
