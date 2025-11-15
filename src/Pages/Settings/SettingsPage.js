import React, { useState } from 'react';
import './SettingsPage.css';
import ChipProgress from '../../components/ChipProgress/ChipProgress';
import InputCard from '../../components/Cards/InputCard/InputCard';
import UploadCard from '../../components/Cards/UploadCard/UploadCard';
import Button from '../../components/Button/Button';
import InventoryItem from '../../components/InventoryItem/InventoryItem';
import FurnitureItem from '../../components/FurnitureItem/FurnitureItem';
import Icon from '../../components/Icon/Icon';
import FormField from '../../components/FormField/FormField'
import PasswordStrength from '../../components/PasswordStrength/PasswordStrength';

// --- Mock Data ---
const mockInventories = [
  { id: 1, name: 'New inventory' },
  { id: 2, name: 'Adult-Centric Library' },
  { id: 3, name: 'Study-Centric Library' },
  { id: 4, name: 'Outdated Inventory' },
];

const mockFurniture = {
  1: [ // New inventory
    { id: 'f1', title: 'Curved Library Shelf', subtitle: 'Height: [CM] | Width: [CM]' },
    { id: 'f2', title: 'Cushioned Study Chair', subtitle: 'Height: [CM] | Width: [CM]' },
    { id: 'f3', title: 'Eight Seater Study Table', subtitle: 'Height: [CM] | Width: [CM]' },
    { id: 'f4', title: 'Four Seater Sofa', subtitle: 'Description of Nav Bar Item' },
    { id: 'f5', title: 'Plastic Study Chair', subtitle: 'Height: [CM] | Width: [CM]' },
    { id: 'f6', title: 'Single Seater Sofa', subtitle: 'Height: [CM] | Width: [CM]' },
    { id: 'f7', title: 'Two Seater Sofa', subtitle: 'Height: [CM] | Width: [CM]' },
    { id: 'f8', title: 'Cushioned Study Chair', subtitle: 'Height: [CM] | Width: [CM]' },
  ],
  2: [ // Adult-Centric Library
    { id: 'f9', title: '4 Tiered Library Shelf', subtitle: 'Height: [CM] | Width: [CM]' },
    { id: 'f10', title: "Children's Low Library Shelf", subtitle: 'Height: [CM] | Width: [CM]' },
  ],
  3: [ // Study-Centric Library
    { id: 'f11', title: 'Study Carrel', subtitle: 'Height: [CM] | Width: [CM]' },
    { id: 'f12', title: 'Whiteboard on Wheels', subtitle: 'Height: [CM] | Width: [CM]' },
  ],
  4: [ // Outdated Inventory
    { id: 'f13', title: 'Old Wooden Chair', subtitle: 'Height: [CM] | Width: [CM]' },
  ]
};

const calculatePasswordStrength = (pass) => {
  if (!pass || pass.length === 0) return 0;
  if (pass === '************') return 3; // Don't run on the placeholder
  
  let score = 0;
  if (pass.length > 8) score++;
  if (pass.match(/[a-z]/)) score++;
  if (pass.match(/[A-Z]/)) score++;
  if (pass.match(/[0-9]/)) score++;
  if (pass.match(/[^a-zA-Z0-9]/)) score++; // Special characters

  // Clamp score between 1 and 4 if it has any length
  return Math.max(1, Math.min(score, 4));
};

function SettingsPage() {
  const [activeChip, setActiveChip] = useState('inventory');
  const [isListEditing, setIsListEditing] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState(null);
  const [isDetailsEditing, setIsDetailsEditing] = useState(false);
  const [username, setUsername] = useState('nlb2025');
  const [password, setPassword] = useState('************');
  const [passwordStrength, setPasswordStrength] = useState(3); // 0-4
  const handleFileSelected = (files) => {
    if (files.length > 0) {
      console.log("Files selected:", files[0].name);
    }
  };

  const handleInventoryClick = (id) => {
    if (selectedInventoryId === id) {
      setSelectedInventoryId(null);
      setIsDetailsEditing(false);
    } else {
      setSelectedInventoryId(id);
      setIsDetailsEditing(false);
    }
  };

    const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    setPasswordStrength(calculatePasswordStrength(newPassword));
  };

  const selectedInventory = mockInventories.find(inv => inv.id === selectedInventoryId);
  const furnitureForSelectedInventory = mockFurniture[selectedInventoryId] || [];

  return (
    <div className="settings-page">
      <ChipProgress
        activeChip={activeChip === 'inventory' ? 'results' : 'input'}
        onChipClick={(chip) => setActiveChip(chip === 'input' ? 'account' : 'inventory')}
        chipLabels={{ input: 'Account', results: 'Inventory' }}
      />

      {/* Inventory Tab */}
      {activeChip === 'inventory' ? (
        <>
          <div className="settings-grid">
            <InputCard 
              icon="List" 
              title="Current Inventory Collections"
              subtitle="Your previously saved inventory collections"
              contentPadding="none"
              headerActions={
                <Button 
                  variant={isListEditing ? 'default' : 'outline'} 
                  size="small"
                  onClick={() => setIsListEditing(!isListEditing)}
                >
                  {isListEditing ? 'Done' : 'Edit'}
                </Button>
              }
            >
              <div className="inventory-list">
                {mockInventories.map((inv) => (
                  <InventoryItem
                    key={inv.id}
                    title={inv.name}
                    isEditing={isListEditing}
                    isSelected={selectedInventoryId === inv.id}
                    onClick={() => handleInventoryClick(inv.id)}
                    onDelete={() => console.log('Delete inventory:', inv.name)}
                  />
                ))}
              </div>
            </InputCard>

            <UploadCard
              icon="UploadCloud"
              title="Inventory Upload"
              subtitle="Upload your inventory of furniture here."
              uploadText="Upload your inventory spreadsheet"
              formatText="Excel (.xlsx), CSV, or Google Sheets format"
              onFileSelect={handleFileSelected}
            />
          </div>

          {selectedInventory && (
            <InputCard
              icon="Building"
              title={selectedInventory.name}
              subtitle="The furniture and shelves within this collection"
              contentPadding="none"
              className="inventory-details-card"
              headerActions={
                isDetailsEditing ? (
                  <>
                    <Button 
                      variant="outline" 
                      size="small"
                      onClick={() => setIsDetailsEditing(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="default" 
                      size="small"
                      onClick={() => setIsDetailsEditing(false)}
                    >
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      size="small"
                      onClick={() => setIsDetailsEditing(true)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="default" 
                      size="small"
                      onClick={() => console.log('Add new furniture')}
                    >
                      <Icon name="Plus" size={16} style={{marginRight: '0.5rem'}} />
                      Add
                    </Button>
                  </>
                )
              }
            >
              <div className="input-card-content-padding">
                <div className="furniture-grid">
                  {furnitureForSelectedInventory.map((item) => (
                    <FurnitureItem
                      key={item.id}
                      title={item.title}
                      subtitle={item.subtitle}
                      isEditing={isDetailsEditing}
                      onDelete={() => console.log('Delete furniture:', item.title)}
                    />
                  ))}
                </div>
              </div>
            </InputCard>
          )}
        </>
      ) : (

        // --- Account Tab ---
        <div className="account-content">
          <div className="account-card">
            
            <FormField
              label="Username"
              icon="User"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              helpIcon="HelpCircle"
            />
            
            <FormField
              label="Password"
              icon="Lock"
              type="password"
              value={password}
              onChange={handlePasswordChange}
            />

            <PasswordStrength strength={passwordStrength} />

            <div className="labelling-section">
              <div className="labelling-header">
                <label className="form-field-label">Labelling</label>
              </div>
              <div className="labelling-buttons">
                <Button variant="text" size="small">Download Labelling Template</Button>
                <Button variant="text" size="small">Upload Labelling File</Button>
                <Button variant="text" size="small">View In Use Labelling File</Button>
              </div>
            </div>

          </div>
          
          <div className="page-actions">
            <Button variant="outline" size="default">Cancel</Button>
            <Button variant="default" size="default">Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;