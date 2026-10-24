-- Update packages with data_package_id for mashup packages
UPDATE packages 
SET data_package_id = 16
WHERE size_gb_text = '1077mins + 2.6GB' OR (size_gb = 2.6 AND network = 'mashup');

UPDATE packages 
SET data_package_id = 20
WHERE size_gb_text = '1485mins + 3.61GB' OR (size_gb = 3.61 AND network = 'mashup');
