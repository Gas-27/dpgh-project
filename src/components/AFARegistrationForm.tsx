import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { registerAFA } from '@/services/afa-service';
import { Loader2, AlertCircle } from 'lucide-react';

interface AFARegistrationFormProps {
  storeId: string;
  storeType: 'agent' | 'subagent';
  packageId: string;
  packageName: string;
  amount: number;
  onSuccess?: () => void;
}

export default function AFARegistrationForm({
  storeId,
  storeType,
  packageId,
  packageName,
  amount,
  onSuccess,
}: AFARegistrationFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_id: '',
    date_of_birth: '',
    town: '',
    occupation: '',
    region: '',
    crop: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.customer_name.trim()) {
        setError('Customer name is required');
        setLoading(false);
        return;
      }

      if (!formData.customer_phone.trim()) {
        setError('Phone number is required');
        setLoading(false);
        return;
      }

      // Validate phone number format
      const phoneRegex = /^[0-9+\-\s()]+$/;
      if (!phoneRegex.test(formData.customer_phone)) {
        setError('Invalid phone number format');
        setLoading(false);
        return;
      }

      // Submit registration
      const result = await registerAFA(
        {
          ...formData,
          package_id: packageId,
          amount: amount,
        },
        storeId,
        storeType
      );

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });

        // Reset form
        setFormData({
          customer_name: '',
          customer_phone: '',
          customer_id: '',
          date_of_birth: '',
          town: '',
          occupation: '',
          region: '',
          crop: '',
        });

        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(result.message);
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AFA Registration</CardTitle>
        <CardDescription>
          Register for {packageName} - GHS {amount.toFixed(2)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex gap-2 p-3 rounded-md bg-red-50 border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Required Fields */}
          <div className="space-y-2">
            <Label htmlFor="customer_name">Full Name *</Label>
            <Input
              id="customer_name"
              name="customer_name"
              value={formData.customer_name}
              onChange={handleChange}
              placeholder="Enter your full name"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_phone">Phone Number *</Label>
            <Input
              id="customer_phone"
              name="customer_phone"
              type="tel"
              value={formData.customer_phone}
              onChange={handleChange}
              placeholder="e.g., +233501234567"
              disabled={loading}
              required
            />
          </div>

          {/* Optional Fields */}
          <div className="space-y-2">
            <Label htmlFor="customer_id">ID Number</Label>
            <Input
              id="customer_id"
              name="customer_id"
              value={formData.customer_id}
              onChange={handleChange}
              placeholder="National ID or Passport number"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <Input
              id="date_of_birth"
              name="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="town">Town</Label>
            <Input
              id="town"
              name="town"
              value={formData.town}
              onChange={handleChange}
              placeholder="Your town"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation</Label>
            <Input
              id="occupation"
              name="occupation"
              value={formData.occupation}
              onChange={handleChange}
              placeholder="e.g., Farmer, Trader"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              name="region"
              value={formData.region}
              onChange={handleChange}
              placeholder="Your region"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="crop">Crop Type</Label>
            <Input
              id="crop"
              name="crop"
              value={formData.crop}
              onChange={handleChange}
              placeholder="Type of crop"
              disabled={loading}
            />
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={loading} size="lg">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Registering...' : `Register for GHS ${amount.toFixed(2)}`}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            * Required fields. Your information is secure and will only be used for AFA registration.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
