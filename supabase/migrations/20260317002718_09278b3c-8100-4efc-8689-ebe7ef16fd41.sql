
-- Seed data packages for all networks and sizes
INSERT INTO public.data_packages (network, size_gb, price, agent_price) VALUES
-- MTN
('mtn', 1, 5, 4), ('mtn', 2, 10, 8), ('mtn', 3, 15, 12), ('mtn', 4, 20, 16),
('mtn', 5, 25, 20), ('mtn', 6, 30, 24), ('mtn', 10, 50, 40), ('mtn', 15, 70, 56),
('mtn', 20, 90, 72), ('mtn', 25, 110, 88), ('mtn', 30, 130, 104), ('mtn', 40, 170, 136),
('mtn', 50, 200, 160), ('mtn', 100, 380, 304),
-- AirtelTigo
('airteltigo', 1, 5, 4), ('airteltigo', 2, 10, 8), ('airteltigo', 3, 15, 12), ('airteltigo', 4, 20, 16),
('airteltigo', 5, 25, 20), ('airteltigo', 6, 30, 24), ('airteltigo', 10, 50, 40), ('airteltigo', 15, 70, 56),
('airteltigo', 20, 90, 72), ('airteltigo', 25, 110, 88), ('airteltigo', 30, 130, 104), ('airteltigo', 40, 170, 136),
('airteltigo', 50, 200, 160), ('airteltigo', 100, 380, 304),
-- Telecel
('telecel', 1, 5, 4), ('telecel', 2, 10, 8), ('telecel', 3, 15, 12), ('telecel', 4, 20, 16),
('telecel', 5, 25, 20), ('telecel', 6, 30, 24), ('telecel', 10, 50, 40), ('telecel', 15, 70, 56),
('telecel', 20, 90, 72), ('telecel', 25, 110, 88), ('telecel', 30, 130, 104), ('telecel', 40, 170, 136),
('telecel', 50, 200, 160), ('telecel', 100, 380, 304);
