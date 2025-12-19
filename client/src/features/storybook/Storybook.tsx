import React, { useState, useEffect } from 'react';
import CustomButton from '../../shared/components/ui/CustomButton';
import CustomInput from '../../shared/components/ui/CustomInput';
import CustomCheckbox from '../../shared/components/ui/CustomCheckbox';
import CustomRadio from '../../shared/components/ui/CustomRadio';
import CustomCard from '../../shared/components/ui/CustomCard';
import CustomModal from '../../shared/components/ui/CustomModal';
import CustomDropdown from '../../shared/components/ui/CustomDropdown';
import CustomSearchInput from '../../shared/components/ui/CustomSearchInput';
import CustomTagInput from '../../shared/components/ui/CustomTagInput';
import CustomTable from '../../shared/components/ui/CustomTable';
import CustomToggle from '../../shared/components/ui/CustomToggle';
import CustomFileUploader from '../../shared/components/ui/CustomFileUploader';
import './Storybook.css';

interface SearchResult {
    id: number;
    label: string;
}

interface TableRow {
    id: number;
    name: string;
    role: string;
    status: string;
}

interface TableColumn {
    key: string;
    label: string;
    render?: (row: TableRow) => React.ReactNode;
}

interface PropInfo {
    name: string;
    type: string;
    default?: string;
    description: string;
    required?: boolean;
}

interface Story {
    id: string;
    name: string;
    component: React.ReactNode;
    code: string;
    props?: PropInfo[];
    description?: string;
}

interface ComponentGroup {
    id: string;
    name: string;
    icon: string;
    stories: Story[];
}

const Storybook: React.FC = () => {
    const [showModal, setShowModal] = useState<boolean>(false);
    const [activeStory, setActiveStory] = useState<string>('button-variants');
    const [expandedGroups, setExpandedGroups] = useState<string[]>(['buttons', 'inputs', 'selects', 'data', 'feedback']);
    const [showCode, setShowCode] = useState<boolean>(false);
    const [showDocs, setShowDocs] = useState<boolean>(true);
    const [canvasBackground, setCanvasBackground] = useState<'light' | 'dark' | 'grid'>('light');
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
    const [sidebarSearchQuery, setSidebarSearchQuery] = useState<string>('');

    // State for interactive examples
    const [searchVal, setSearchVal] = useState<string>('');
    const [tags, setTags] = useState<string[]>(['React', 'Bootstrap']);
    const [file, setFile] = useState<File | null>(null);
    const [toggle, setToggle] = useState<boolean>(false);
    const [darkModeToggle, setDarkModeToggle] = useState<boolean>(false);
    const [radioVal, setRadioVal] = useState<string>('1');
    const [checkVal, setCheckVal] = useState<boolean>(false);
    const [selectVal, setSelectVal] = useState<any>(null);

    const searchResults: SearchResult[] = [
        { id: 1, label: 'Result 1' },
        { id: 2, label: 'Result 2' },
        { id: 3, label: 'Result 3' },
    ].filter(i => i.label.toLowerCase().includes(searchVal.toLowerCase()));

    const tableData: TableRow[] = [
        { id: 1, name: 'John Doe', role: 'Admin', status: 'Active' },
        { id: 2, name: 'Jane Smith', role: 'User', status: 'Inactive' },
        { id: 3, name: 'Bob Johnson', role: 'Editor', status: 'Active' },
    ];

    const tableColumns: TableColumn[] = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'role', label: 'Role' },
        {
            key: 'status',
            label: 'Status',
            render: (row: TableRow) => (
                <span className={`sb-badge ${row.status === 'Active' ? 'sb-badge-success' : 'sb-badge-secondary'}`}>
                    {row.status}
                </span>
            )
        },
    ];

    const handleSearchSelect = (item: SearchResult) => {
        setSearchVal(item.label);
    };

    const handleTableAction = (row: TableRow) => (
        <CustomButton
            size="sm"
            variant="outline-primary"
            onClick={() => alert(`Edit ${row.name}`)}
        >
            Edit
        </CustomButton>
    );

    const componentGroups: ComponentGroup[] = [
        {
            id: 'buttons',
            name: 'Buttons',
            icon: '🔘',
            stories: [
                {
                    id: 'button-variants',
                    name: 'Variants',
                    description: 'CustomButton supports multiple variants for different use cases. Use primary for main actions, secondary for less prominent actions, and danger for destructive operations.',
                    component: (
                        <div className="sb-component-row">
                            <CustomButton variant="primary">Primary</CustomButton>
                            <CustomButton variant="secondary">Secondary</CustomButton>
                            <CustomButton variant="outline-primary">Outline</CustomButton>
                            <CustomButton variant="success">Success</CustomButton>
                            <CustomButton variant="danger">Danger</CustomButton>
                            <CustomButton variant="warning">Warning</CustomButton>
                        </div>
                    ),
                    code: `import CustomButton from '@/components/ui/CustomButton';

// Primary button for main actions
<CustomButton variant="primary">Primary</CustomButton>

// Secondary button for less prominent actions
<CustomButton variant="secondary">Secondary</CustomButton>

// Outline style
<CustomButton variant="outline-primary">Outline</CustomButton>

// Semantic variants
<CustomButton variant="success">Success</CustomButton>
<CustomButton variant="danger">Danger</CustomButton>
<CustomButton variant="warning">Warning</CustomButton>`,
                    props: [
                        { name: 'variant', type: 'string', default: '"primary"', description: 'Button style variant', required: false },
                        { name: 'size', type: '"sm" | "md" | "lg"', default: '"md"', description: 'Button size' },
                        { name: 'onClick', type: '() => void', description: 'Click handler function', required: true },
                        { name: 'children', type: 'ReactNode', description: 'Button content', required: true },
                    ]
                },
                {
                    id: 'button-states',
                    name: 'States',
                    description: 'Buttons can be in loading or disabled states to indicate status.',
                    component: (
                        <div className="sb-component-row">
                            <CustomButton variant="primary">Default</CustomButton>
                            <CustomButton variant="primary" loading>Loading</CustomButton>
                            <CustomButton variant="primary" disabled>Disabled</CustomButton>
                        </div>
                    ),
                    code: `// Default state
<CustomButton variant="primary">Default</CustomButton>

// Loading state - shows spinner
<CustomButton variant="primary" loading>Loading</CustomButton>

// Disabled state
<CustomButton variant="primary" disabled>Disabled</CustomButton>`,
                    props: [
                        { name: 'loading', type: 'boolean', default: 'false', description: 'Shows loading spinner when true' },
                        { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables button interaction' },
                    ]
                },
                {
                    id: 'button-sizes',
                    name: 'Sizes',
                    description: 'Buttons come in three sizes to fit various contexts.',
                    component: (
                        <div className="sb-component-row sb-align-center">
                            <CustomButton variant="primary" size="sm">Small</CustomButton>
                            <CustomButton variant="primary">Medium</CustomButton>
                            <CustomButton variant="primary" size="lg">Large</CustomButton>
                        </div>
                    ),
                    code: `<CustomButton variant="primary" size="sm">Small</CustomButton>
<CustomButton variant="primary">Medium</CustomButton>
<CustomButton variant="primary" size="lg">Large</CustomButton>`,
                },
            ]
        },
        {
            id: 'inputs',
            name: 'Form Inputs',
            icon: '📝',
            stories: [
                {
                    id: 'input-basic',
                    name: 'Basic Input',
                    description: 'Standard text input with label support and validation states.',
                    component: (
                        <div className="sb-component-column" style={{ maxWidth: '400px', width: '100%' }}>
                            <CustomInput
                                label="Username"
                                name="username"
                                placeholder="Enter username"
                                onChange={() => { }}
                            />
                            <CustomInput
                                label="Password"
                                name="password"
                                type="password"
                                placeholder="Enter password"
                                onChange={() => { }}
                            />
                        </div>
                    ),
                    code: `<CustomInput 
  label="Username" 
  name="username" 
  placeholder="Enter username"
  onChange={(e) => setValue(e.target.value)}
/>

<CustomInput 
  label="Password" 
  name="password" 
  type="password"
  placeholder="Enter password"
  onChange={(e) => setValue(e.target.value)}
/>`,
                    props: [
                        { name: 'label', type: 'string', description: 'Input label text' },
                        { name: 'name', type: 'string', description: 'Input name attribute', required: true },
                        { name: 'type', type: 'string', default: '"text"', description: 'Input type (text, password, email, etc.)' },
                        { name: 'placeholder', type: 'string', description: 'Placeholder text' },
                        { name: 'onChange', type: '(e) => void', description: 'Change handler', required: true },
                        { name: 'error', type: 'string', description: 'Error message to display' },
                    ]
                },
                {
                    id: 'input-error',
                    name: 'Error State',
                    description: 'Inputs display validation errors clearly to users.',
                    component: (
                        <div className="sb-component-column" style={{ maxWidth: '400px', width: '100%' }}>
                            <CustomInput
                                label="Email"
                                name="email"
                                type="email"
                                error="Please enter a valid email address"
                                onChange={() => { }}
                            />
                        </div>
                    ),
                    code: `<CustomInput 
  label="Email" 
  name="email" 
  type="email"
  error="Please enter a valid email address"
  onChange={(e) => setValue(e.target.value)}
/>`,
                },
                {
                    id: 'input-textarea',
                    name: 'Textarea',
                    description: 'Multi-line text input for longer content.',
                    component: (
                        <div className="sb-component-column" style={{ maxWidth: '400px', width: '100%' }}>
                            <CustomInput
                                label="Bio"
                                name="bio"
                                as="textarea"
                                rows={4}
                                placeholder="Tell us about yourself..."
                                onChange={() => { }}
                            />
                        </div>
                    ),
                    code: `<CustomInput 
  label="Bio" 
  name="bio" 
  as="textarea"
  rows={4}
  placeholder="Tell us about yourself..."
  onChange={(e) => setValue(e.target.value)}
/>`,
                },
                {
                    id: 'checkbox',
                    name: 'Checkbox',
                    description: 'Standard checkbox for boolean selections.',
                    component: (
                        <div className="sb-component-column">
                            <CustomCheckbox
                                label="I agree to the terms and conditions"
                                name="terms"
                                checked={checkVal}
                                onChange={(checked: boolean) => setCheckVal(checked)}
                            />
                            <CustomCheckbox
                                label="Subscribe to newsletter"
                                name="newsletter"
                                checked={false}
                                onChange={() => { }}
                            />
                        </div>
                    ),
                    code: `<CustomCheckbox
  label="I agree to the terms and conditions"
  name="terms"
  checked={isChecked}
  onChange={(checked) => setIsChecked(checked)}
/>`,
                    props: [
                        { name: 'label', type: 'string', description: 'Checkbox label', required: true },
                        { name: 'name', type: 'string', description: 'Input name attribute', required: true },
                        { name: 'checked', type: 'boolean', description: 'Checked state', required: true },
                        { name: 'onChange', type: '(checked: boolean) => void', description: 'Change handler', required: true },
                    ]
                },
                {
                    id: 'radio',
                    name: 'Radio',
                    description: 'Radio buttons for single selection from multiple options.',
                    component: (
                        <div className="sb-component-column">
                            <CustomRadio
                                label="Option A"
                                name="options"
                                value="a"
                                checked={radioVal === 'a'}
                                onChange={(val: string | number) => setRadioVal(String(val))}
                            />
                            <CustomRadio
                                label="Option B"
                                name="options"
                                value="b"
                                checked={radioVal === 'b'}
                                onChange={(val: string | number) => setRadioVal(String(val))}
                            />
                            <CustomRadio
                                label="Option C"
                                name="options"
                                value="c"
                                checked={radioVal === 'c'}
                                onChange={(val: string | number) => setRadioVal(String(val))}
                            />
                        </div>
                    ),
                    code: `<CustomRadio
  label="Option A"
  name="options"
  value="a"
  checked={selectedValue === 'a'}
  onChange={(val) => setSelectedValue(val)}
/>`,
                },
                {
                    id: 'toggle',
                    name: 'Toggle',
                    description: 'Switch toggle for on/off states.',
                    component: (
                        <div className="sb-component-column">
                            <CustomToggle
                                label="Enable notifications"
                                name="notifications"
                                checked={toggle}
                                onChange={(checked: boolean) => setToggle(checked)}
                            />
                            <CustomToggle
                                label="Dark mode"
                                name="darkmode"
                                checked={darkModeToggle}
                                onChange={(checked: boolean) => setDarkModeToggle(checked)}
                            />
                        </div>
                    ),
                    code: `<CustomToggle
  label="Enable notifications"
  name="notifications"
  checked={isEnabled}
  onChange={(checked) => setIsEnabled(checked)}
/>`,
                },
            ]
        },
        {
            id: 'selects',
            name: 'Selection',
            icon: '📋',
            stories: [
                {
                    id: 'dropdown',
                    name: 'Dropdown',
                    description: 'Dropdown select powered by react-select for single or multi selections.',
                    component: (
                        <div style={{ maxWidth: '350px', width: '100%' }}>
                            <CustomDropdown
                                label="Select Role"
                                options={[
                                    { value: 'admin', label: 'Administrator' },
                                    { value: 'editor', label: 'Editor' },
                                    { value: 'viewer', label: 'Viewer' },
                                ]}
                                value={selectVal}
                                onChange={setSelectVal}
                            />
                        </div>
                    ),
                    code: `<CustomDropdown
  label="Select Role"
  options={[
    { value: 'admin', label: 'Administrator' },
    { value: 'editor', label: 'Editor' },
    { value: 'viewer', label: 'Viewer' },
  ]}
  value={selectedRole}
  onChange={setSelectedRole}
/>`,
                    props: [
                        { name: 'label', type: 'string', description: 'Dropdown label' },
                        { name: 'options', type: 'Array<{value, label}>', description: 'Array of options', required: true },
                        { name: 'value', type: 'object | null', description: 'Selected value' },
                        { name: 'onChange', type: '(value) => void', description: 'Change handler', required: true },
                        { name: 'isMulti', type: 'boolean', default: 'false', description: 'Enable multi-select' },
                    ]
                },
                {
                    id: 'search-input',
                    name: 'Search Input',
                    description: 'Input with autocomplete suggestions and search functionality.',
                    component: (
                        <div style={{ maxWidth: '350px', width: '100%' }}>
                            <CustomSearchInput
                                label="Search Users"
                                name="search"
                                value={searchVal}
                                onChange={setSearchVal}
                                results={searchResults}
                                onSelect={handleSearchSelect}
                                placeholder="Type to search..."
                            />
                        </div>
                    ),
                    code: `const [query, setQuery] = useState('');
const results = data.filter(item => 
  item.label.toLowerCase().includes(query.toLowerCase())
);

<CustomSearchInput
  label="Search Users"
  name="search"
  value={query}
  onChange={setQuery}
  results={results}
  onSelect={(item) => handleSelect(item)}
  placeholder="Type to search..."
/>`,
                },
                {
                    id: 'tag-input',
                    name: 'Tag Input',
                    description: 'Multi-value input for tags or keywords with suggestions.',
                    component: (
                        <div style={{ maxWidth: '400px', width: '100%' }}>
                            <CustomTagInput
                                label="Skills"
                                name="skills"
                                value={tags}
                                onChange={setTags}
                                suggestions={['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Go']}
                                placeholder="Add a skill..."
                            />
                        </div>
                    ),
                    code: `<CustomTagInput
  label="Skills"
  name="skills"
  value={selectedTags}
  onChange={setSelectedTags}
  suggestions={['JavaScript', 'TypeScript', 'React', 'Node.js']}
  placeholder="Add a skill..."
/>`,
                    props: [
                        { name: 'label', type: 'string', description: 'Input label' },
                        { name: 'name', type: 'string', description: 'Input name', required: true },
                        { name: 'value', type: 'string[]', description: 'Array of selected tags', required: true },
                        { name: 'onChange', type: '(tags: string[]) => void', description: 'Change handler', required: true },
                        { name: 'suggestions', type: 'string[]', description: 'Available suggestions' },
                    ]
                },
            ]
        },
        {
            id: 'data',
            name: 'Data Display',
            icon: '📊',
            stories: [
                {
                    id: 'table',
                    name: 'Table',
                    description: 'Data table with custom column rendering and actions.',
                    component: (
                        <div style={{ width: '100%' }}>
                            <CustomTable
                                columns={tableColumns}
                                data={tableData}
                                actions={handleTableAction}
                            />
                        </div>
                    ),
                    code: `const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { 
    key: 'status', 
    label: 'Status',
    render: (row) => <Badge variant={row.status}>{row.status}</Badge>
  },
];

<CustomTable
  columns={columns}
  data={users}
  actions={(row) => (
    <Button onClick={() => handleEdit(row)}>Edit</Button>
  )}
/>`,
                    props: [
                        { name: 'columns', type: 'Column[]', description: 'Table column definitions', required: true },
                        { name: 'data', type: 'T[]', description: 'Array of data rows', required: true },
                        { name: 'actions', type: '(row: T) => ReactNode', description: 'Action column renderer' },
                        { name: 'loading', type: 'boolean', default: 'false', description: 'Show loading state' },
                    ]
                },
                {
                    id: 'card',
                    name: 'Card',
                    description: 'Container component for grouping related content.',
                    component: (
                        <div className="sb-component-row" style={{ width: '100%' }}>
                            <CustomCard title="Standard Card" className="sb-demo-card">
                                <p>This is a standard card with a title and content area.</p>
                            </CustomCard>
                            <CustomCard title="Dashed Card" dashed className="sb-demo-card">
                                <p>This card has a dashed border style.</p>
                            </CustomCard>
                        </div>
                    ),
                    code: `// Standard card
<CustomCard title="Card Title">
  <p>Card content goes here.</p>
</CustomCard>

// Dashed border style
<CustomCard title="Dashed Card" dashed>
  <p>This card has a dashed border.</p>
</CustomCard>`,
                },
            ]
        },
        {
            id: 'feedback',
            name: 'Feedback',
            icon: '💬',
            stories: [
                {
                    id: 'modal',
                    name: 'Modal',
                    description: 'Dialog component for confirmations and forms.',
                    component: (
                        <div>
                            <CustomButton onClick={() => setShowModal(true)}>Open Modal</CustomButton>
                            <CustomModal
                                show={showModal}
                                onHide={() => setShowModal(false)}
                                title="Confirm Action"
                                footer={
                                    <>
                                        <CustomButton variant="secondary" onClick={() => setShowModal(false)}>Cancel</CustomButton>
                                        <CustomButton variant="primary" onClick={() => setShowModal(false)}>Confirm</CustomButton>
                                    </>
                                }
                            >
                                <p>Are you sure you want to proceed with this action?</p>
                            </CustomModal>
                        </div>
                    ),
                    code: `const [showModal, setShowModal] = useState(false);

<CustomButton onClick={() => setShowModal(true)}>
  Open Modal
</CustomButton>

<CustomModal
  show={showModal}
  onHide={() => setShowModal(false)}
  title="Confirm Action"
  footer={
    <>
      <CustomButton variant="secondary" onClick={() => setShowModal(false)}>
        Cancel
      </CustomButton>
      <CustomButton variant="primary" onClick={() => setShowModal(false)}>
        Confirm
      </CustomButton>
    </>
  }
>
  <p>Are you sure you want to proceed?</p>
</CustomModal>`,
                    props: [
                        { name: 'show', type: 'boolean', description: 'Controls modal visibility', required: true },
                        { name: 'onHide', type: '() => void', description: 'Close handler', required: true },
                        { name: 'title', type: 'string', description: 'Modal title' },
                        { name: 'footer', type: 'ReactNode', description: 'Footer content (usually buttons)' },
                        { name: 'children', type: 'ReactNode', description: 'Modal body content' },
                    ]
                },
                {
                    id: 'file-uploader',
                    name: 'File Uploader',
                    description: 'Drag and drop file upload component.',
                    component: (
                        <div style={{ maxWidth: '500px', width: '100%' }}>
                            <CustomFileUploader
                                label="Upload Document"
                                name="document"
                                onChange={(f) => setFile(f)}
                                onDelete={() => setFile(null)}
                                fileName={file?.name}
                                file={file}
                            />
                        </div>
                    ),
                    code: `const [file, setFile] = useState(null);

<CustomFileUploader
  label="Upload Document"
  name="document"
  onChange={(file) => setFile(file)}
  onDelete={() => setFile(null)}
  fileName={file?.name}
  accept=".pdf,.doc,.docx"
/>`,
                    props: [
                        { name: 'label', type: 'string', description: 'Upload label' },
                        { name: 'name', type: 'string', description: 'Input name', required: true },
                        { name: 'onChange', type: '(file: File) => void', description: 'File select handler', required: true },
                        { name: 'onDelete', type: '() => void', description: 'Delete handler' },
                        { name: 'fileName', type: 'string', description: 'Current file name' },
                        { name: 'file', type: 'File | null', description: 'File object for preview (newly selected files)' },
                        { name: 'fileUrl', type: 'string', description: 'URL for preview (existing server files)' },
                        { name: 'accept', type: 'string', description: 'Accepted file types' },
                    ]
                },
            ]
        },
    ];

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    const findCurrentStory = (): Story | undefined => {
        for (const group of componentGroups) {
            const story = group.stories.find(s => s.id === activeStory);
            if (story) return story;
        }
        return undefined;
    };

    const findCurrentGroup = (): ComponentGroup | undefined => {
        for (const group of componentGroups) {
            if (group.stories.some(s => s.id === activeStory)) {
                return group;
            }
        }
        return undefined;
    };

    const currentStory = findCurrentStory();
    const currentGroup = findCurrentGroup();

    const filteredComponentGroups = componentGroups.map(group => ({
        ...group,
        stories: group.stories.filter(story =>
            story.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase()) ||
            group.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
        )
    })).filter(group => group.stories.length > 0);

    // Auto-expand groups when searching
    useEffect(() => {
        if (sidebarSearchQuery.trim() !== '') {
            const groupsToExpand = filteredComponentGroups.map(g => g.id);
            setExpandedGroups(prev => Array.from(new Set([...prev, ...groupsToExpand])));
        }
    }, [sidebarSearchQuery, filteredComponentGroups]);

    return (
        <div className="sb-container">
            {/* Sidebar */}
            <aside className={`sb-sidebar ${sidebarCollapsed ? 'sb-sidebar-collapsed' : ''}`}>
                <div className="sb-sidebar-header">
                    <div className="sb-logo">
                        <span className="sb-logo-icon">📚</span>
                        {!sidebarCollapsed && <span className="sb-logo-text">Storybook</span>}
                    </div>
                    <button
                        className="sb-sidebar-toggle"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    >
                        {sidebarCollapsed ? '→' : '←'}
                    </button>
                </div>

                {!sidebarCollapsed && (
                    <>
                        <div className="sb-search-container">
                            <input
                                type="text"
                                className="sb-search-input"
                                placeholder="Find components..."
                                value={sidebarSearchQuery}
                                onChange={(e) => setSidebarSearchQuery(e.target.value)}
                            />
                            <span className="sb-search-icon">🔍</span>
                        </div>

                        <nav className="sb-nav">
                            {filteredComponentGroups.map(group => (
                                <div key={group.id} className="sb-nav-group">
                                    <button
                                        className="sb-nav-group-header"
                                        onClick={() => toggleGroup(group.id)}
                                    >
                                        <span className="sb-nav-group-icon">{group.icon}</span>
                                        <span className="sb-nav-group-name">{group.name}</span>
                                        <span className={`sb-nav-chevron ${expandedGroups.includes(group.id) ? 'expanded' : ''}`}>
                                            ▸
                                        </span>
                                    </button>
                                    {expandedGroups.includes(group.id) && (
                                        <ul className="sb-nav-stories">
                                            {group.stories.map(story => (
                                                <li key={story.id}>
                                                    <button
                                                        className={`sb-nav-story ${activeStory === story.id ? 'active' : ''}`}
                                                        onClick={() => setActiveStory(story.id)}
                                                    >
                                                        <span className="sb-story-icon">◇</span>
                                                        {story.name}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </nav>
                    </>
                )}
            </aside>

            {/* Main Content */}
            <main className="sb-main">
                {/* Toolbar */}
                <header className="sb-toolbar">
                    <div className="sb-toolbar-left">
                        <div className="sb-breadcrumb">
                            <span className="sb-breadcrumb-item">{currentGroup?.name}</span>
                            <span className="sb-breadcrumb-separator">/</span>
                            <span className="sb-breadcrumb-item active">{currentStory?.name}</span>
                        </div>
                    </div>
                    <div className="sb-toolbar-right">
                        <div className="sb-toolbar-group">
                            <button
                                className={`sb-toolbar-btn ${canvasBackground === 'light' ? 'active' : ''}`}
                                onClick={() => setCanvasBackground('light')}
                                title="Light background"
                            >
                                ☀️
                            </button>
                            <button
                                className={`sb-toolbar-btn ${canvasBackground === 'dark' ? 'active' : ''}`}
                                onClick={() => setCanvasBackground('dark')}
                                title="Dark background"
                            >
                                🌙
                            </button>
                            <button
                                className={`sb-toolbar-btn ${canvasBackground === 'grid' ? 'active' : ''}`}
                                onClick={() => setCanvasBackground('grid')}
                                title="Grid background"
                            >
                                ⊞
                            </button>
                        </div>
                        <div className="sb-toolbar-divider"></div>
                        <div className="sb-toolbar-group">
                            <button
                                className={`sb-toolbar-btn ${showDocs ? 'active' : ''}`}
                                onClick={() => setShowDocs(!showDocs)}
                            >
                                📖 Docs
                            </button>
                            <button
                                className={`sb-toolbar-btn ${showCode ? 'active' : ''}`}
                                onClick={() => setShowCode(!showCode)}
                            >
                                {'</>'} Code
                            </button>
                        </div>
                    </div>
                </header>

                {/* Canvas Area */}
                <div className="sb-content">
                    {currentStory && (
                        <>
                            {showDocs && (
                                <div className="sb-docs-section">
                                    <h1 className="sb-docs-title">{currentStory.name}</h1>
                                    {currentStory.description && (
                                        <p className="sb-docs-description">{currentStory.description}</p>
                                    )}
                                </div>
                            )}

                            <div className={`sb-canvas sb-canvas-${canvasBackground}`}>
                                <div className="sb-canvas-label">
                                    <span>Canvas</span>
                                </div>
                                <div className="sb-component-preview">
                                    {currentStory.component}
                                </div>
                            </div>

                            {showCode && (
                                <div className="sb-code-section">
                                    <div className="sb-code-header">
                                        <span>Code</span>
                                        <button
                                            className="sb-copy-btn"
                                            onClick={() => navigator.clipboard.writeText(currentStory.code)}
                                        >
                                            📋 Copy
                                        </button>
                                    </div>
                                    <pre className="sb-code-block">
                                        <code>{currentStory.code}</code>
                                    </pre>
                                </div>
                            )}

                            {showDocs && currentStory.props && currentStory.props.length > 0 && (
                                <div className="sb-props-section">
                                    <h3 className="sb-props-title">Props</h3>
                                    <div className="sb-props-table-container">
                                        <table className="sb-props-table">
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Type</th>
                                                    <th>Default</th>
                                                    <th>Description</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentStory.props.map((prop, idx) => (
                                                    <tr key={idx}>
                                                        <td>
                                                            <code className="sb-prop-name">{prop.name}</code>
                                                            {prop.required && <span className="sb-required">*</span>}
                                                        </td>
                                                        <td><code className="sb-prop-type">{prop.type}</code></td>
                                                        <td><code className="sb-prop-default">{prop.default || '-'}</code></td>
                                                        <td className="sb-prop-desc">{prop.description}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Storybook;
