
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // Add Firebase Storage domain if you plan to use it for images
      // Replace 'your-project-id.appspot.com' with your actual storage bucket domain
      {
        protocol: 'https',
        hostname: '*.firebaseapp.com', // More generic if needed
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: '*.appspot.com', // For default Firebase storage bucket URLs
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
