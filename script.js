document.addEventListener('DOMContentLoaded', () => {
    // Scroll Reveal Animation
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.glass-panel').forEach(panel => {
        panel.classList.add('fade-in');
        observer.observe(panel);
    });

    // Auto-update latest YouTube video from channel RSS feed
    const CHANNEL_ID = 'UCayIhjKhh0KFaJlzRIRkSZQ';
    const ytIframe = document.getElementById('youtube-latest-player');
    if (ytIframe) {
        const rssUrl = encodeURIComponent(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`);
        fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.items && data.items.length > 0) {
                    const latestItem = data.items[0];
                    // guid format: yt:video:VIDEO_ID
                    const parts = (latestItem.guid || '').split(':');
                    const videoId = parts[parts.length - 1];
                    if (videoId && !ytIframe.src.includes(videoId)) {
                        ytIframe.src = `https://www.youtube.com/embed/${videoId}`;
                    }
                }
            })
            .catch(() => {
                // Keep default fallback video if RSS service is unreachable
            });
    }
});
