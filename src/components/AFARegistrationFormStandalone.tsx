'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, Info, Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/dist/style.css';

export default function AFARegistrationFormStandalone() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registrationFee, setRegistrationFee] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    ghana_card: '',
    date_of_birth: '',
    town: '',
    occupation: '',
    region: '',
    crop: 'Yam', // Fixed to Yam only
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

  // Load registration fee from settings
  useEffect(() => {
    const loadRegistrationFee = async () => {
      try {
        const { data, error } = await supabase
          .from('afa_settings')
          .select('registration_fee, registration_enabled')
          .single();

        if (error) {
          console.error('[v0] Error loading AFA settings:', error);
          setRegistrationFee(15);
          return;
        }

        if (data) {
          setRegistrationFee(data.registration_fee || 15);
          if (!data.registration_enabled) {
            setError('AFA registration is currently disabled');
          }
        } else {
          setRegistrationFee(15);
        }
      } catch (err) {
        console.error('[v0] Error loading registration fee:', err);
        setRegistrationFee(15);
      }
    };

    loadRegistrationFee();
  }, []);

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
        setError('Full name is required');
        setLoading(false);
        return;
      }

      if (!formData.customer_phone.trim()) {
        setError('Phone number is required');
        setLoading(false);
        return;
      }

      if (!formData.ghana_card.trim() || formData.ghana_card.length < 14) {
        setError('Valid Ghana Card number is required');
        setLoading(false);
        return;
      }

      if (!formData.date_of_birth) {
        setError('Date of birth is required');
        setLoading(false);
        return;
      }

      if (!formData.town.trim()) {
        setError('Town is required');
        setLoading(false);
        return;
      }

      if (!formData.region) {
        setError('Region is required');
        setLoading(false);
        return;
      }

      // Call the Supabase edge function to initialize payment
      console.log('[v0] Calling AFA registration edge function...');
      
      const response = await supabase.functions.invoke('AFA-registration', {
        body: {
          fullName: formData.customer_name,
          phoneNumber: formData.customer_phone,
          idNumber: formData.ghana_card,
          dateOfBirth: formData.date_of_birth,
          town: formData.town,
          occupation: 'Farmer',
          region: formData.region,
          cropProduce: formData.crop,
          agentStoreId: null, // Can be passed from props if needed
          subagentStoreId: null, // Can be passed from props if needed
        },
      });

      console.log('[v0] Edge function response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Failed to initialize payment');
      }

      const data = response.data;

      if (data.success && data.data?.authorization_url) {
        console.log('[v0] Redirecting to Paystack:', data.data.authorization_url);
        // Redirect to Paystack checkout
        window.location.href = data.data.authorization_url;
      } else {
        throw new Error(data.message || 'Failed to initialize payment');
      }
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Payment initialization failed';
      console.error('[v0] Error during registration:', message);
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  if (registrationFee === null) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AFA Registration Form</CardTitle>
        <CardDescription>
          Register for our Agriculture and Farming Association program
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Important Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-semibold text-blue-900">Important Notice</p>
                <p className="text-sm text-blue-800">
                  Registration fee is <strong>GH₵{registrationFee.toFixed(2)}</strong> and is <strong>non-refundable</strong>. 
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

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="customer_name">Full Name *</Label>
            <Input
              id="customer_name"
              name="customer_name"
              value={formData.customer_name}
              onChange={handleChange}
              placeholder="Enter customer's full name"
              disabled={loading}
              required
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="customer_phone">Phone Number *</Label>
            <Input
              id="customer_phone"
              name="customer_phone"
              type="tel"
              value={formData.customer_phone}
              onChange={handleChange}
              placeholder="e.g., 0241234567"
              disabled={loading}
              required
            />
          </div>

          {/* Ghana Card Number */}
          <div className="space-y-2">
            <Label htmlFor="ghana_card">Ghana Card Number *</Label>
            <Input
              id="ghana_card"
              name="ghana_card"
              value={formData.ghana_card}
              onChange={handleChange}
              placeholder="GHA-XXXXXXXXX-X"
              disabled={loading}
              required
              maxLength={14}
            />
            <p className="text-xs text-muted-foreground">Format: GHA-XXXXXXXXX-X (auto-formatted as you type)</p>
          </div>

          {/* Date of Birth */}
          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth * <span className="text-xs text-muted-foreground">(same as on your Ghana card)</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  disabled={loading}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'yyyy/MM/dd') : 'Select date of birth'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <DayPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    if (date) {
                      setFormData((prev) => ({
                        ...prev,
                        date_of_birth: format(date, 'yyyy/MM/dd'),
                      }));
                    }
                  }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">Click to select your date of birth</p>
          </div>

          {/* Town */}
          <div className="space-y-2">
            <Label htmlFor="town">Town *</Label>
            <Input
              id="town"
              name="town"
              value={formData.town}
              onChange={handleChange}
              placeholder="e.g., Accra"
              disabled={loading}
              required
            />
          </div>

          {/* Occupation */}
          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation</Label>
            <div className="relative">
              <Input
                id="occupation"
                name="occupation"
                value="Farmer"
                disabled
                className="bg-muted text-foreground opacity-60 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted-foreground">Fixed as Farmer for AFA registration</p>
          </div>

          {/* Region */}
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

          {/* Crop Produce - Fixed to Yam */}
          <div className="space-y-2">
            <Label htmlFor="crop">Crop Produce *</Label>
            <div className="bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-base">
              <p className="font-medium">Yam</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">This is fixed for AFA registration</p>
            </div>
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={loading} size="lg">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Submitting...' : `Register (GH₵${registrationFee.toFixed(2)})`}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            * Required fields. Your information is secure and will only be used for AFA registration.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
