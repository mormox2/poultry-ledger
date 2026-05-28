-- ==============================================================================
-- SQL MIGRATION : ACTIVER LA SÉCURITÉ DE NIVEAU LIGNE (RLS) - POULTRY LEDGER
-- Auteur: Antigravity AI
-- Cible: Supabase PostgreSQL Database (Résolution du Risque de Sécurité 1)
-- ==============================================================================

-- 1. Activation globale de la sécurité (RLS) sur toutes les tables de la base
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- 2. Suppression préventive des politiques existantes pour éviter les doublons
DROP POLICY IF EXISTS "Users can manage their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can manage their own clients" ON clients;
DROP POLICY IF EXISTS "Users can manage their own suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can manage ledger entries of their own clients" ON ledger_entries;
DROP POLICY IF EXISTS "Users can manage purchases of their own suppliers" ON purchases;

-- 3. Politique pour la table 'profiles'
-- Permet à l'utilisateur authentifié de voir et modifier uniquement son propre profil
CREATE POLICY "Users can manage their own profile" 
ON profiles 
FOR ALL 
TO authenticated 
USING (id = auth.uid()) 
WITH CHECK (id = auth.uid());

-- 4. Politique pour la table 'clients'
-- Permet à l'utilisateur de gérer uniquement ses propres clients
CREATE POLICY "Users can manage their own clients" 
ON clients 
FOR ALL 
TO authenticated 
USING (profile_id = auth.uid()) 
WITH CHECK (profile_id = auth.uid());

-- 5. Politique pour la table 'suppliers' (Masse de données Achats)
-- Permet à l'utilisateur de gérer uniquement ses propres fournisseurs
CREATE POLICY "Users can manage their own suppliers" 
ON suppliers 
FOR ALL 
TO authenticated 
USING (profile_id = auth.uid()) 
WITH CHECK (profile_id = auth.uid());

-- 6. Politique relationnelle pour la table 'ledger_entries' (Registre quotidien Ventes)
-- Permet de lire et écrire des lignes du registre UNIQUEMENT si le client lié appartient à l'utilisateur connecté
CREATE POLICY "Users can manage ledger entries of their own clients" 
ON ledger_entries 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = ledger_entries.client_id 
    AND clients.profile_id = auth.uid()
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = ledger_entries.client_id 
    AND clients.profile_id = auth.uid()
  )
);

-- 7. Politique relationnelle pour la table 'purchases' (Registre quotidien Achats)
-- Permet de lire et écrire des lignes d'achats UNIQUEMENT si le fournisseur lié appartient à l'utilisateur connecté
CREATE POLICY "Users can manage purchases of their own suppliers" 
ON purchases 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM suppliers 
    WHERE suppliers.id = purchases.supplier_id 
    AND suppliers.profile_id = auth.uid()
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM suppliers 
    WHERE suppliers.id = purchases.supplier_id 
    AND suppliers.profile_id = auth.uid()
  )
);
