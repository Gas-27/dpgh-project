import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { registerAFA } from '@/services/afa-service';
import { Loader2, AlertCircle, Info } from 'lucide-react';

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
    ghana_card: '',
    date_of_birth: '',
    town: '',
    occupation: '',
    region: '',
    crop: '',
  });

  const GHANA_REGIONS = [
    'Ahafo',
    'Ashanti',
    'Bono',
    'Bono East',
    'Central',
    'Eastern',
    'Greater Accra',
    'North East',
    'Northern',
    'Oti',
    'Savannah',
    'Upper East',
    'Upper West',
    'Volta',
    'Western',
    'Western North',
  ];

  const CROP_TYPES = ['Cassava', 'Maize', 'Yam', 'Plantain', 'Onion', 'Pepper', 'Tomatoes'];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let finalValue = value;

    // Auto-format Ghana card number: GHA-XXXXXXXXX-X
    if (name === 'ghana_card') {
      const digitsOnly = value.replace(/[^\d]/g, '');
      if (digitsOnly.length <= 10) {
        if (digitsOnly.length <= 9) {
          finalValue = 'GHA-' + digitsOnly;
        } else {
          finalValue = 'GHA-' + digitsOnly.substring(0, 9) + '-' + digitsOnly.substring(9);
        }
      }
    }

    setFormData((prev) => ({ ...prev, [name]: finalValue }));
    setError('');
  };

  const handleSelectChange = (name: string, value: string) => {
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
          ghana_card: '',
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
          Register for {packageName} - GHC {amount.toFixed(2)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-semibold text-blue-900">Important Notice</p>
                <p className="text-sm text-blue-800">
                  Registration fee is <strong>GHC{amount.toFixed(2)}</strong> and is <strong>non-refundable</strong>. 
                  Ensure all details are correct before submitting.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex gap-2 p-3 rounded-md bg-red-50 border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Registration Form Fields */}

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

          <div className="space-y-2">
            <Label htmlFor="ghana_card">Ghana Card Number *</Label>
            <Input
              id="ghana_card"
              name="ghana_card"
              value={formData.ghana_card}
              onChange={handleChange}
              placeholder="Enter 10 digits"
              disabled={loading}
              required
              maxLength={14}
              pattern="\d*"
            />
            <p className="text-xs text-muted-foreground">Format: GHA-XXXXXXXXX-X (auto-formatted)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth * <span className="text-xs text-muted-foreground">(same as on your Ghana card)</span></Label>
            <Input
              id="date_of_birth"
              name="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="town">Town *</Label>
            <Input
              id="town"
              name="town"
              value={formData.town}
              onChange={handleChange}
              placeholder="Your town"
              disabled={loading}
              required
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
            <Label htmlFor="region">Region *</Label>
            <Select value={formData.region} onValueChange={(value) => handleSelectChange('region', value)} disabled={loading}>
              <SelectTrigger id="region">
                <SelectValue placeholder="Select your region" />
              </SelectTrigger>
              <SelectContent>
                {GHANA_REGIONS.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="crop">Crop Type *</Label>
            <Select value={formData.crop} onValueChange={(value) => handleSelectChange('crop', value)} disabled={loading}>
              <SelectTrigger id="crop">
                <SelectValue placeholder="Select crop type" />
              </SelectTrigger>
              <SelectContent>
                {CROP_TYPES.map((crop) => (
                  <SelectItem key={crop} value={crop}>
                    {crop}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Important Notice */}
          <div className="flex gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Important Notice</p>
              <p>Registration fee is <span className="font-semibold">GHS {amount.toFixed(2)}</span> and is non-refundable. Ensure all details are correct before submitting.</p>
            </div>
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
