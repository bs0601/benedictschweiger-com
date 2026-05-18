const DASHBOARD_URL = '/workflow/dashboard-metrics.json';

async function loadDashboard() {
    const btn = document.getElementById('refresh-btn');
    if (btn) {
        btn.classList.add('spinning');
        btn.disabled = true;
    }

    let data = null;
    const debugDiv = document.getElementById('dashboard-debug');
    if (debugDiv) debugDiv.textContent = 'Loading...';

    try {
        const res = await fetch(DASHBOARD_URL + '?t=' + Date.now());
        if (res.ok) {
            data = await res.json();
            if (debugDiv) debugDiv.textContent = '';
        } else {
            if (debugDiv) debugDiv.textContent = 'Server returned ' + res.status;
        }
    } catch (e) {
        if (debugDiv) debugDiv.textContent = 'Network error: ' + e.message;
    }

    if (data) {
        renderDashboard(data);
        const legacy = document.getElementById('legacy-stats');
        if (legacy) legacy.style.display = 'none';
    }

    if (btn) {
        btn.classList.remove('spinning');
        btn.disabled = false;
    }
}

function renderDashboard(data) {
    const blog = data.blog || {};
    const linkedin = data.linkedin || {};
    const brevo = data.brevo || {};
    const scout = data.scout || {};

    // Blog
    const blogViews = document.getElementById('kpi-blog-views');
    if (blogViews) blogViews.textContent = (blog.pageviews_28d || 0).toLocaleString();
    
    const blogUsers = document.getElementById('kpi-blog-users');
    if (blogUsers) blogUsers.textContent = (blog.users_28d || 0).toLocaleString() + ' unique users · ' + (blog.posts_with_traffic || 0) + ' posts';
    
    const blogNote = document.getElementById('kpi-blog-note');
    if (blogNote) blogNote.textContent = blog.period || '28-day rolling';

    // LinkedIn
    const liStale = linkedin.stale;
    const liImpressions = document.getElementById('kpi-li-impressions');
    if (liImpressions) liImpressions.textContent = (linkedin.impressions_28d || 0).toLocaleString();
    
    const liReach = document.getElementById('kpi-li-reach');
    if (liReach) liReach.textContent = (linkedin.reach_28d || 0).toLocaleString() + ' reach · ' + (linkedin.engagement_rate || 0) + '% engagement';
    
    const liStatus = document.getElementById('kpi-li-status');
    if (liStatus) liStatus.className = 'kpi-status ' + (liStale ? 'yellow' : 'green');
    
    const liNote = document.getElementById('kpi-li-note');
    if (liNote) {
        if (liStale) {
            liNote.textContent = '⚠ Stale — last update: ' + (linkedin.last_updated || 'unknown');
            liNote.classList.add('stale');
        } else {
            liNote.textContent = (linkedin.followers_total || 0).toLocaleString() + ' followers (+' + (linkedin.followers_new || 0) + ')';
            liNote.classList.remove('stale');
        }
    }

    // Newsletter
    const newsletter = document.getElementById('kpi-newsletter');
    if (newsletter) newsletter.textContent = (brevo.newsletter_subscribers || 0).toLocaleString();
    
    const newsletterTotal = document.getElementById('kpi-newsletter-total');
    if (newsletterTotal) newsletterTotal.textContent = (brevo.total_contacts || 0).toLocaleString() + ' total contacts';

    // Scout
    const scoutCards = document.getElementById('kpi-scout-cards');
    if (scoutCards) scoutCards.textContent = scout.cards_last_night || 0;
    
    const scoutYield = document.getElementById('kpi-scout-yield');
    if (scoutYield) scoutYield.textContent = (scout.yield_pct || 0) + '% yield · ' + (scout.sources || 0) + ' sources';

    // Timestamp
    const generated = data.generated_at ? new Date(data.generated_at) : new Date();
    const timestamp = document.getElementById('dashboard-timestamp');
    if (timestamp) {
        timestamp.textContent = 'Last updated: ' + generated.toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }) + ' GMT-3';
    }

    // Content table
    renderContentTable(data._blogPosts || []);
}

function renderContentTable(posts) {
    const tbody = document.getElementById('content-tbody');
    if (!tbody) return;
    if (!posts || posts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#666;">No content data available</td></tr>';
        return;
    }
    tbody.innerHTML = posts.map(p => `
        <tr>
            <td>${escapeHtml(p.slug || 'unknown')}</td>
            <td>${p.pageviews || 0}</td>
            <td>${p.users || 0}</td>
            <td>${Math.round(p.avg_session_duration || 0)}s</td>
            <td>${Math.round((p.bounce_rate || 0) * 100)}%</td>
        </tr>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDashboard);
} else {
    loadDashboard();
}
