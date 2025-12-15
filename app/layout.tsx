import "./global.css";

export const metadata = {
  title: "Football AI Stat",
  description: "Get football statistics using AI",
};

const RootLayout = ({ children }) => {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
};
export default RootLayout;
