Project Name: Cortex TV
Role: Expert React Developer
Goal: Build a complete React (Vite) web application that functions as an interactive 3D Globe IPTV player, similar to "Radio Garden" but for live TV channels.

Tech Stack to Use:

Frontend Framework: React (using Vite)

Styling: Tailwind CSS

3D Globe: react-globe.gl and three

Video Player: react-player (needs to support HLS/.m3u8 streams)

Icons: lucide-react

Core Features & Architecture Requirements:

1. The 3D Globe Component (GlobeView.jsx):

Render a full-screen interactive 3D globe using react-globe.gl.

Use a dark/night theme for the globe image (//unpkg.com/three-globe/example/img/earth-night.jpg) and a star map for the background (//unpkg.com/three-globe/example/img/night-sky.png).

Add clickable markers (Pins/Labels) for specific countries (e.g., Jordan, Egypt, USA, Japan). Use coordinates (lat/lng) for these markers.

When a user clicks on a country marker, the camera should smoothly zoom in, and a Sidebar should open.

2. The Sidebar/Channel List Component (Sidebar.jsx):

A modern, dark-themed sidebar positioned on the right side of the screen.

It should display the selected country's name and a list of available TV channels.

Each channel item should have a name, a small logo placeholder, and a category (e.g., News, Entertainment).

When a channel is clicked, it should trigger the Video Player.

3. The Video Player Component (PlayerModal.jsx):

A floating, draggable, or overlay modal in the center or bottom-left of the screen.

Use react-player to play .m3u8 (HLS) live stream URLs.

Include standard controls (play, pause, volume, full-screen).

Include a "Close" button to stop the stream and hide the player.

4. Data Management:

Create a data.js file with mock data to start. Include an array of countries with their coordinates (lat, lng), and nested arrays of TV channels (Name, Category, and a working .m3u8 test URL).

Example Test URL for HLS: https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8 (Use this for all mock channels to ensure the player works).

Action Plan for jules:

Initialize the Vite React project and install all required dependencies.

Set up Tailwind CSS.

Create the mock data structure.

Build the components step-by-step and wire the state management (selected country, selected channel).

Ensure the UI is responsive and looks futuristic (dark mode, neon accents).

Please generate the full project structure and write the necessary code for all files to make this app fully functional.