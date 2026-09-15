import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase';
import CapacitorBackButtonHandler from '@/components/CapacitorBackButtonHandler';


export const metadata: Metadata = {
  title: 'Hostel In - A Hostel Administration Platform',
  description: 'The complete multi-hostel campus management platform for Boys & Girls Hostels.',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var userAuth = localStorage.getItem('hostelin_auth');
                var activeHostelId = localStorage.getItem('hostelin_active_hostel_id');
                var mode = 'dark';
                if (userAuth) {
                  var user = JSON.parse(userAuth);
                  if (user.role === 'CHIEF_WARDEN' && !activeHostelId) {
                    mode = localStorage.getItem('hostelin_chief_mode') || 'dark';
                  } else {
                    var targetHostelId = activeHostelId || user.hostelId;
                    if (targetHostelId) {
                      mode = localStorage.getItem('hostel_mode_' + targetHostelId) || 'dark';
                    } else {
                      mode = localStorage.getItem('hostelin_theme_mode') || 'dark';
                    }
                  }
                } else {
                  mode = localStorage.getItem('hostelin_theme_mode') || 'dark';
                }
                if (mode === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body bg-background text-foreground min-h-screen">
        <FirebaseClientProvider>
          
          <CapacitorBackButtonHandler />
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
