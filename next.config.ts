import type {NextConfig} from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// Add polyfill for Promise.withResolvers
require('./polyfill.js');

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
    /* config options here */
};

export default withNextIntl(nextConfig);
