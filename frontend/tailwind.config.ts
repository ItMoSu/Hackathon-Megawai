import type { Config } from "tailwindcss";

const config: Config = {
content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
],
theme: {
    extend: {
    colors: {
        primary: {
        DEFAULT: '#DC2626', 
        hover: '#B91C1C',   
        foreground: '#FFFFFF', 
        },
        secondary: {
        DEFAULT: '#000000', 
        foreground: '#FFFFFF', 
        },
        background: '#FFFFFF', 
        surface: '#FAFAFA',    
        border: '#E5E7EB',     
        danger: {
        DEFAULT: '#EF4444', 
        hover: '#DC2626',
        },
    },
    },
},
plugins: [],
};
export default config;