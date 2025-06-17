# Fitm8 - Mobile App

A React Native fitness matching app built with Expo that connects runners and fitness enthusiasts for shared workout experiences.

## 🚀 Features

- **User Authentication**: Secure login/signup with Supabase Auth
- **Profile Management**: Customizable user profiles with bio, fitness goals, and preferences
- **Run Creation**: Create and manage workout sessions with location, distance, and pace targets
- **Smart Matching**: AI-powered matching system based on user preferences and workout goals
- **Swipe Interface**: Tinder-like swipe interface to discover and join runs
- **Real-time Chat**: In-app messaging system for matched users
- **Notifications**: Push notifications for new matches and messages

## 🛠 Tech Stack

- **Framework**: React Native with Expo (~53.0.0)
- **Navigation**: Expo Router with typed routes
- **Backend**: Supabase (Database, Auth, Real-time)
- **Language**: TypeScript
- **State Management**: React Hooks & Context API
- **UI Components**: Custom components with theme support
- **Testing**: Jest with Expo preset

## 📱 App Structure

```
app/
├── (tabs)/                 # Tab navigation screens
│   ├── home.tsx           # Main dashboard with runs and discovery
│   └── chats.tsx          # Chat conversations list
├── chat/[id].tsx          # Individual chat screen
├── swipe/[id].tsx         # Swipe interface for discovering runs
├── context/               # React Context providers
├── login.tsx              # Authentication screens
├── signup.tsx
└── index.tsx              # App entry point with auth routing

components/
├── ui/                    # Reusable UI components
├── ChatCard.tsx           # Chat conversation preview
├── RunCard.tsx            # Run display component
├── SwipeView.tsx          # Swipe interface component
├── ProfileModal.tsx       # User profile modal
└── NewRunModal.tsx        # Create new run modal

services/
└── matchingService.ts     # AI matching logic and vector embeddings

lib/
└── supabase.ts           # Supabase client configuration
```

## 🔧 Setup & Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. **Clone the repository and navigate to the Code directory**
   ```bash
   cd Code
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - The app is configured to use a Supabase backend
   - Database types are auto-generated in `database.types.ts`
   - Update Supabase configuration in `lib/supabase.ts` if needed

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Run on specific platforms**
   ```bash
   npm run ios     # iOS Simulator
   npm run android # Android Emulator
   npm run web     # Web browser
   ```

## 📝 Available Scripts

- `npm start` - Start the Expo development server
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator
- `npm run web` - Run in web browser
- `npm test` - Run Jest tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run supabase:types:pull` - Update database types from Supabase

## 🎨 Key Features Explained

### Authentication Flow
- Users start at the index screen which checks authentication state
- Redirects to login/signup for unauthenticated users
- Authenticated users are directed to the main app (tabs)

### Home Screen
- Displays user's created runs
- "Discover" mode shows available runs from other users
- Floating action button to create new runs
- Profile access via header avatar

### Matching System
- Vector-based similarity matching using embeddings
- Considers user bio, location, pace, and distance preferences
- Implemented in `services/matchingService.ts`

### Swipe Interface
- Tinder-like interface for discovering runs
- Swipe right to join, left to pass
- Real-time updates when users match

### Chat System
- Real-time messaging between matched users
- Chat list shows all active conversations
- Individual chat screens with message history

## 🗄 Database Schema

The app uses Supabase with the following key tables:
- `user` - User profiles and preferences
- `run` - Workout sessions/runs
- `run_user` - Many-to-many relationship for run participants
- `chat` - Chat conversations
- `message` - Individual chat messages

Types are automatically generated and available in `database.types.ts`.

## 🎯 Development Guidelines

### Code Style
- TypeScript is required for all new code
- Use Prettier for code formatting (`npm run format`)
- Follow ESLint rules (`npm run lint`)

### Component Structure
- Use functional components with hooks
- Implement proper TypeScript interfaces
- Follow the existing theming system in `constants/Colors.ts`

### State Management
- Use React Context for global state (notifications, auth)
- Local state with useState/useEffect for component-specific data
- Supabase real-time subscriptions for live data

## 🔐 Environment & Security

- Supabase configuration includes public anon key (safe for client-side)
- Row Level Security (RLS) policies handle data access control
- Authentication handled entirely by Supabase Auth

## 📱 Platform Support

- **iOS**: Full support with native iOS components
- **Android**: Full support with native Android components  
- **Web**: Basic support for development/testing

## 🚀 Deployment

The app is configured for deployment with:
- Expo Application Services (EAS)
- Project ID: `790224fa-7d05-4bfa-881e-9286e506b6cc`
- Owner: `danielfalbo`
- Updates via Expo Updates service

## 🤝 Contributing

1. Follow the existing code style and structure
2. Add TypeScript types for all new features
3. Test on both iOS and Android platforms
4. Update this README for significant changes

## 📄 License

This project is private and part of an HCI course project.
