import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React ecosystem
          'react-vendor': ['react', 'react-dom'],
          'react-router': ['react-router-dom'],

          // UI libraries
          'ui-vendor': [
            '@headlessui/react',
            'lucide-react',
            'framer-motion'
          ],

          // Form and utility libraries
          'form-utils': [
            'react-hook-form',
            'zustand'
          ],

          // Auth libraries
          'auth-vendor': ['auth0-js'],

          // HTTP client
          'http-vendor': ['axios'],

          // DnD Kit (if used extensively)
          'dnd-vendor': [
            '@dnd-kit/core',
            '@dnd-kit/sortable',
            '@dnd-kit/utilities'
          ],

          // Group your API services
          'api-services': [
            '/src/api/auth',
            '/src/api/catalog',
            '/src/api/interaction',
            '/src/api/users',
            '/src/api/lists',
            '/src/api/preferences'
          ],

          // Group utility functions
          'utils': [
            '/src/utils/axios-factory',
            '/src/utils/auth0-config',
            '/src/utils/formatters',
            '/src/utils/error-handler',
            '/src/utils/grading-utils',
            '/src/utils/validation-utils',
            '/src/utils/searchService',
            '/src/utils/preview-extractor',
            '/src/utils/GradeColorUtils'
          ],

          // Profile-related components (since Profile is complex)
          'profile-components': [
            '/src/components/Profile/ProfileHeader',
            '/src/components/Profile/ProfileTabs',
            '/src/components/Profile/ProfileSettingsTab',
            '/src/components/Profile/GradingMethodsTab',
            '/src/components/Profile/SocialTabContent',
            '/src/components/Profile/PreferencesTab',
            '/src/components/Profile/ProfileHistoryTab',
            '/src/components/Profile/ProfileListsTab',
            '/src/components/Profile/ProfileOverviewTab'
          ],

          // Create Interaction components (heavy features)
          'interaction-components': [
            '/src/components/CreateInteraction/GradingSelector',
            '/src/components/CreateInteraction/DynamicGradingCalculator',
            '/src/components/CreateInteraction/BlockGrader',
            '/src/components/CreateInteraction/GradeSlider',
            '/src/components/CreateInteraction/StarRating',
            '/src/components/CreateInteraction/NormalizedStarDisplay',
            '/src/components/CreateInteraction/MusicInteractionModal'
          ],

          // Grading Method components
          'grading-components': [
            '/src/components/CreateGradingMethod/BlockEditor',
            '/src/components/CreateGradingMethod/GradeEditor',
            '/src/components/CreateGradingMethod/OperationSelector',
            '/src/components/CreateGradingMethod/HelpModal'
          ]
        }
      }
    },
    // Increase the chunk size warning limit if needed
    chunkSizeWarningLimit: 1000
  },
  server: {
    proxy: {
      // User service endpoints
      '/api/v1/users': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1\/users/, '/api/v1')
      },
      '/auth': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/users/subscriptions':{
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/public/users':{
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      // Catalog service endpoints
      '/api/v1/catalog': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1\/catalog/, '/api/v1')
      },

      // ItemHistory and Grading service endpoints
      '/api/v1/interactions': {
        target: 'http://localhost:5003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1\/interactions/, '/api/v1')
      },
      '/api/v1/grading-methods': {
        target: 'http://localhost:5003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1\/grading-methods/, '/api')
      },

      // Spotify preview proxy (for audio previews)
      '/spotify': {
        target: 'https://open.spotify.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/spotify/, '')
      }
    },
  },
})