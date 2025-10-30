import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Link } from "wouter";

export default function NotFound() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-green-50 grocery-bg">
      <Card className="w-full max-w-md mx-4 bg-white/80 backdrop-blur-sm border-white/20">
        <CardContent className="pt-6">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('notFound.title')}</h1>
            <p className="text-gray-600 mb-6">{t('notFound.description')}</p>
            
            <Link href="/sales-orders">
              <Button className="bg-green-600 hover:bg-green-700">
                <Home className="w-4 h-4 mr-2" />
                {t('notFound.backToHome')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
