import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Evermore',
        short_name: 'Evermore',
        description: 'Preserve your family\'s priceless stories through voice conversations.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#FCF8F3',
        theme_color: '#FCF8F3',
        icons: [
            {
                src: '/favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any',
            },
            {
                src: '/evermore-icon-terracotta.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'monochrome',
            }
        ],
    };
}
