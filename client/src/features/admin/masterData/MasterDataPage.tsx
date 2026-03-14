import React, { useState, useEffect, useCallback, FormEvent } from "react";
import {
    Table,
    Button,
    Form,
    Modal,
    Nav,
    Spinner,
    Badge,
} from "react-bootstrap";
import { Pencil, Trash2, Plus, Search, RotateCcw, Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import AsyncSelect from "react-select/async";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import AlertModal, {
    AlertType,
} from "../../../shared/components/ui/AlertModal";

import "./MasterDataPage.css";

// ============================================
// TYPES
// ============================================

interface Department {
    id: number;
    code: string | null;
    name: string;
    type: string;
    parent_id: number | null;
    parent_name: string | null;
    hod_name: string | null;
    email: string | null;
    phone: string | null;
    is_active: number;
    sort_order: number;
}

interface EntityType {
    id: number;
    code: string;
    name: string;
}

interface EntityContact {
    role: string;
    email: string;
}

interface Entity {
    id: number;
    entity_type_id: number;
    type_code: string;
    type_name: string;
    code: string | null;
    name: string;
    is_active: number;
    sort_order: number;
    contacts: EntityContact[];
}

interface Employee {
    id: number;
    erp_id: string;
    title: string | null;
    first_name: string;
    last_name: string | null;
    full_name: string;
    email: string;
    mobile: string | null;
    designation: string | null;
    department_id: number | null;
    department_name: string | null;
    department_code: string | null;
    entity_id: number | null;
    entity_name: string | null;
    entity_code: string | null;
    employee_type: string;
    status: string;
    gender: string | null;
    dob: string | null;
    doj: string | null;
    dor: string | null;
    orcid_id: string | null;
    wos_researcher_id: string | null;
    scopus_id: string | null;
    google_scholar_id: string | null;
}

interface EmployeeLookupOption {
    value: number;
    label: string;
    email: string;
    mobile: string | null;
}

type TabKey = "departments" | "entities" | "employees";

type SortDirection = 'asc' | 'desc';
interface SortConfig {
    key: string;
    direction: SortDirection;
}

// ============================================
// COMPONENT
// ============================================

export default function MasterDataPage() {
    const baseUrl = authenticityUtility.getBaseURL();
    const [activeTab, setActiveTab] = useState<TabKey>("departments");

    const [deptSort, setDeptSort] = useState<SortConfig | null>(null);
    const [entitySort, setEntitySort] = useState<SortConfig | null>(null);
    const [empSort, setEmpSort] = useState<SortConfig | null>(null);

    const handleSort = (
        key: string,
        sortConfig: SortConfig | null,
        setSortConfig: React.Dispatch<React.SetStateAction<SortConfig | null>>
    ) => {
        let direction: SortDirection = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedData = (data: any[], sortConfig: SortConfig | null) => {
        if (!sortConfig) return data;
        return [...data].sort((a, b) => {
            let valA = a[sortConfig.key] || '';
            let valB = b[sortConfig.key] || '';

            // Handle nested properties or special cases
            if (sortConfig.key === 'contacts_email') {
                valA = a.contacts?.[0]?.email || '';
                valB = b.contacts?.[0]?.email || '';
            }
            if (sortConfig.key === 'full_name') {
                valA = `${a.title || ''} ${a.first_name || ''} ${a.last_name || ''}`.trim();
                valB = `${b.title || ''} ${b.first_name || ''} ${b.last_name || ''}`.trim();
            }

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    };

    const renderSortIcon = (key: string, sortConfig: SortConfig | null) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown size={14} className="ms-1 text-muted" />;
        }
        return sortConfig.direction === 'asc' ? (
            <ArrowUp size={14} className="ms-1" />
        ) : (
            <ArrowDown size={14} className="ms-1" />
        );
    };

    // Shared employee lookup for AsyncSelect
    const loadEmployeeOptions = async (inputValue: string): Promise<EmployeeLookupOption[]> => {
        if (!inputValue || inputValue.length < 2) return [];
        try {
            const response = await fetch(
                `${baseUrl}/api/master-data/employees/lookup?search=${encodeURIComponent(inputValue)}`,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                }
            );
            const data = await response.json();
            if (data.status === "success") {
                return data.data.map((emp: any) => ({
                    value: emp.id,
                    label: `${emp.full_name?.trim()} (${emp.erp_id})`,
                    email: emp.email,
                    mobile: emp.mobile,
                }));
            }
        } catch { /* silent */ }
        return [];
    };

    // Alert modal
    const [alertState, setAlertState] = useState({
        show: false,
        message: "" as React.ReactNode,
        type: "info" as AlertType,
        title: "",
        showCancel: false,
        confirmText: "OK",
        onConfirm: undefined as (() => void) | undefined,
    });

    const showAlert = (
        message: React.ReactNode,
        type: AlertType = "info",
        title?: string,
        showCancel = false,
        confirmText = "OK",
        onConfirm?: () => void
    ) => {
        setAlertState({
            show: true,
            message,
            type,
            title: title || "",
            showCancel,
            confirmText,
            onConfirm,
        });
    };

    const closeAlert = () =>
        setAlertState((prev) => ({ ...prev, show: false }));

    // ============================================
    // DEPARTMENTS TAB
    // ============================================

    const [departments, setDepartments] = useState<Department[]>([]);
    const [deptLoading, setDeptLoading] = useState(false);
    const [deptSearch, setDeptSearch] = useState("");
    const [deptTypeFilter, setDeptTypeFilter] = useState("");
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [viewingDept, setViewingDept] = useState<Department | null>(null);
    const [selectedDeptHod, setSelectedDeptHod] = useState<EmployeeLookupOption | null>(null);
    const [deptForm, setDeptForm] = useState({
        code: "",
        name: "",
        type: "Academic",
        parent_id: "",
        hod_name: "",
        email: "",
        phone: "",
        // sort_order: "0",
    });

    const fetchDepartments = useCallback(async () => {
        setDeptLoading(true);
        try {
            const params = new URLSearchParams();
            if (deptSearch) params.set("search", deptSearch);
            if (deptTypeFilter) params.set("type", deptTypeFilter);

            const response = await fetch(
                `${baseUrl}/api/master-data/departments?${params}`,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                }
            );
            const data = await response.json();
            if (data.status === "success") setDepartments(data.data);
        } catch {
            showAlert("Failed to load departments", "error");
        } finally {
            setDeptLoading(false);
        }
    }, [baseUrl, deptSearch, deptTypeFilter]);

    useEffect(() => {
        if (activeTab === "departments") fetchDepartments();
    }, [activeTab, fetchDepartments]);

    const openDeptModal = (dept?: Department) => {
        if (dept) {
            setEditingDept(dept);
            setDeptForm({
                code: dept.code || "",
                name: dept.name,
                type: dept.type,
                parent_id: dept.parent_id ? String(dept.parent_id) : "",
                hod_name: dept.hod_name || "",
                email: dept.email || "",
                phone: dept.phone || "",
                // sort_order: String(dept.sort_order),
            });
            // Pre-populate the HOD select if there is existing data
            if (dept.hod_name) {
                setSelectedDeptHod({
                    value: 0,
                    label: dept.hod_name,
                    email: dept.email || "",
                    mobile: dept.phone || null,
                });
            } else {
                setSelectedDeptHod(null);
            }
        } else {
            setEditingDept(null);
            setDeptForm({
                code: "",
                name: "",
                type: "Academic",
                parent_id: "",
                hod_name: "",
                email: "",
                phone: "",
                // sort_order: "0",
            });
            setSelectedDeptHod(null);
        }
        setShowDeptModal(true);
    };

    const handleDeptSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            const body = {
                ...deptForm,
                parent_id: deptForm.parent_id ? parseInt(deptForm.parent_id) : null,
                // sort_order: parseInt(deptForm.sort_order) || 0,
            };

            const url = editingDept
                ? `${baseUrl}/api/master-data/departments/${editingDept.id}`
                : `${baseUrl}/api/master-data/departments`;

            const response = await fetch(url, {
                method: editingDept ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (data.status === "success") {
                showAlert(
                    editingDept
                        ? "Department updated successfully"
                        : "Department created successfully",
                    "success"
                );
                setShowDeptModal(false);
                fetchDepartments();
            } else {
                showAlert(data.message || "Operation failed", "error");
            }
        } catch {
            showAlert("Failed to save department", "error");
        }
    };

    const handleDeleteDept = (dept: Department) => {
        showAlert(
            <>
                Are you sure you want to deactivate <strong>{dept.name}</strong>?
            </>,
            "warning",
            "Deactivate Department",
            true,
            "Deactivate",
            async () => {
                try {
                    const response = await fetch(
                        `${baseUrl}/api/master-data/departments/${dept.id}`,
                        {
                            method: "DELETE",
                            headers: {
                                Authorization: `Bearer ${localStorage.getItem("token")}`,
                            },
                        }
                    );
                    const data = await response.json();
                    if (data.status === "success") {
                        showAlert("Department deactivated", "success");
                        fetchDepartments();
                    } else {
                        showAlert(data.message || "Failed to deactivate", "error");
                    }
                } catch {
                    showAlert("Failed to deactivate department", "error");
                }
            }
        );
    };

    const handleRestoreDept = async (dept: Department) => {
        try {
            const response = await fetch(
                `${baseUrl}/api/master-data/departments/${dept.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    body: JSON.stringify({ is_active: 1 }),
                }
            );
            const data = await response.json();
            if (data.status === "success") {
                showAlert("Department reactivated", "success");
                fetchDepartments();
            }
        } catch {
            showAlert("Failed to reactivate department", "error");
        }
    };

    // ============================================
    // ENTITIES TAB
    // ============================================

    const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
    const [entities, setEntities] = useState<Entity[]>([]);
    const [entityLoading, setEntityLoading] = useState(false);
    const [entitySearch, setEntitySearch] = useState("");
    const [entityTypeFilter, setEntityTypeFilter] = useState("");
    const [showEntityModal, setShowEntityModal] = useState(false);
    const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
    const [viewingEntity, setViewingEntity] = useState<Entity | null>(null);
    const [entityForm, setEntityForm] = useState({
        entity_type_id: "",
        code: "",
        name: "",
        contact_email: "",
        contact_role: "office",
        // sort_order: "0",
    });

    const fetchEntityTypes = useCallback(async () => {
        try {
            const response = await fetch(`${baseUrl}/api/master-data/entity-types`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });
            const data = await response.json();
            if (data.status === "success") setEntityTypes(data.data);
        } catch {
            /* silent */
        }
    }, [baseUrl]);

    const fetchEntities = useCallback(async () => {
        setEntityLoading(true);
        try {
            const params = new URLSearchParams();
            if (entitySearch) params.set("search", entitySearch);
            if (entityTypeFilter) params.set("entity_type_id", entityTypeFilter);

            const response = await fetch(
                `${baseUrl}/api/master-data/entities?${params}`,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                }
            );
            const data = await response.json();
            if (data.status === "success") setEntities(data.data);
        } catch {
            showAlert("Failed to load entities", "error");
        } finally {
            setEntityLoading(false);
        }
    }, [baseUrl, entitySearch, entityTypeFilter]);

    useEffect(() => {
        if (activeTab === "entities") {
            fetchEntityTypes();
            fetchEntities();
        }
    }, [activeTab, fetchEntities, fetchEntityTypes]);

    const openEntityModal = (entity?: Entity) => {
        if (entity) {
            setEditingEntity(entity);
            const primaryContact = entity.contacts?.[0];
            setEntityForm({
                entity_type_id: String(entity.entity_type_id),
                code: entity.code || "",
                name: entity.name,
                contact_email: primaryContact?.email || "",
                contact_role: primaryContact?.role || "office",
                // sort_order: String(entity.sort_order),
            });
        } else {
            setEditingEntity(null);
            setEntityForm({
                entity_type_id: entityTypes[0]?.id ? String(entityTypes[0].id) : "",
                code: "",
                name: "",
                contact_email: "",
                contact_role: "office",
                // sort_order: "0",
            });
        }
        setShowEntityModal(true);
    };

    const handleEntitySubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            const body = {
                ...entityForm,
                entity_type_id: parseInt(entityForm.entity_type_id),
                // sort_order: parseInt(entityForm.sort_order) || 0,
            };

            const url = editingEntity
                ? `${baseUrl}/api/master-data/entities/${editingEntity.id}`
                : `${baseUrl}/api/master-data/entities`;

            const response = await fetch(url, {
                method: editingEntity ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (data.status === "success") {
                showAlert(
                    editingEntity
                        ? "Entity updated successfully"
                        : "Entity created successfully",
                    "success"
                );
                setShowEntityModal(false);
                fetchEntities();
            } else {
                showAlert(data.message || "Operation failed", "error");
            }
        } catch {
            showAlert("Failed to save entity", "error");
        }
    };

    const handleDeleteEntity = (entity: Entity) => {
        showAlert(
            <>
                Are you sure you want to deactivate <strong>{entity.name}</strong>?
            </>,
            "warning",
            "Deactivate Entity",
            true,
            "Deactivate",
            async () => {
                try {
                    const response = await fetch(
                        `${baseUrl}/api/master-data/entities/${entity.id}`,
                        {
                            method: "DELETE",
                            headers: {
                                Authorization: `Bearer ${localStorage.getItem("token")}`,
                            },
                        }
                    );
                    const data = await response.json();
                    if (data.status === "success") {
                        showAlert("Entity deactivated", "success");
                        fetchEntities();
                    } else {
                        showAlert(data.message || "Failed to deactivate", "error");
                    }
                } catch {
                    showAlert("Failed to deactivate entity", "error");
                }
            }
        );
    };

    const handleRestoreEntity = async (entity: Entity) => {
        try {
            const response = await fetch(
                `${baseUrl}/api/master-data/entities/${entity.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    body: JSON.stringify({ is_active: 1 }),
                }
            );
            const data = await response.json();
            if (data.status === "success") {
                showAlert("Entity reactivated", "success");
                fetchEntities();
            }
        } catch {
            showAlert("Failed to reactivate entity", "error");
        }
    };

    // ============================================
    // EMPLOYEES TAB
    // ============================================

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [empLoading, setEmpLoading] = useState(false);
    const [empSearch, setEmpSearch] = useState("");
    const [empDeptFilter, setEmpDeptFilter] = useState("");
    const [empStatusFilter, setEmpStatusFilter] = useState("");
    const [empTypeFilter, setEmpTypeFilter] = useState("");
    const [empPage, setEmpPage] = useState(1);
    const [empTotal, setEmpTotal] = useState(0);
    const [empTotalPages, setEmpTotalPages] = useState(1);
    const [showEmpModal, setShowEmpModal] = useState(false);
    const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
    const [viewingEmp, setViewingEmp] = useState<Employee | null>(null);
    const [empForm, setEmpForm] = useState({
        erp_id: "",
        title: "",
        first_name: "",
        last_name: "",
        email: "",
        mobile: "",
        gender: "",
        designation: "",
        department_id: "",
        entity_id: "",
        employee_type: "Teaching",
        status: "Active",
        dob: "",
        doj: "",
        dor: "",
        orcid_id: "",
        wos_researcher_id: "",
        scopus_id: "",
        google_scholar_id: "",
    });

    const fetchEmployees = useCallback(async () => {
        setEmpLoading(true);
        try {
            const params = new URLSearchParams();
            if (empSearch) params.set("search", empSearch);
            if (empDeptFilter) params.set("department_id", empDeptFilter);
            if (empStatusFilter) params.set("status", empStatusFilter);
            if (empTypeFilter) params.set("employee_type", empTypeFilter);
            params.set("page", String(empPage));
            params.set("limit", "50");

            const response = await fetch(
                `${baseUrl}/api/master-data/employees?${params}`,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                }
            );
            const data = await response.json();
            if (data.status === "success") {
                setEmployees(data.data.rows);
                setEmpTotal(data.data.total);
                setEmpTotalPages(data.data.totalPages);
            }
        } catch {
            showAlert("Failed to load employees", "error");
        } finally {
            setEmpLoading(false);
        }
    }, [baseUrl, empSearch, empDeptFilter, empStatusFilter, empTypeFilter, empPage]);

    useEffect(() => {
        if (activeTab === "employees") fetchEmployees();
    }, [activeTab, fetchEmployees]);

    // Also fetch departments and entities for employee dropdowns
    const [allDepartments, setAllDepartments] = useState<Department[]>([]);
    const [allEntitiesList, setAllEntitiesList] = useState<Entity[]>([]);

    useEffect(() => {
        const fetchAllDepts = async () => {
            try {
                const response = await fetch(
                    `${baseUrl}/api/master-data/departments?is_active=1`,
                    {
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem("token")}`,
                        },
                    }
                );
                const data = await response.json();
                if (data.status === "success") setAllDepartments(data.data);
            } catch {
                /* silent */
            }
        };
        const fetchAllEntitiesList = async () => {
            try {
                const response = await fetch(
                    `${baseUrl}/api/master-data/entities?is_active=1`,
                    {
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem("token")}`,
                        },
                    }
                );
                const data = await response.json();
                if (data.status === "success") setAllEntitiesList(data.data);
            } catch {
                /* silent */
            }
        };
        fetchAllDepts();
        fetchAllEntitiesList();
    }, [baseUrl]);

    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return "";
        try {
            return new Date(dateStr).toISOString().split("T")[0];
        } catch {
            return "";
        }
    };

    const openEmpModal = (emp?: Employee) => {
        if (emp) {
            setEditingEmp(emp);
            setEmpForm({
                erp_id: emp.erp_id,
                title: emp.title || "",
                first_name: emp.first_name,
                last_name: emp.last_name || "",
                email: emp.email,
                mobile: emp.mobile || "",
                gender: emp.gender || "",
                designation: emp.designation || "",
                department_id: emp.department_id ? String(emp.department_id) : "",
                entity_id: emp.entity_id ? String(emp.entity_id) : "",
                employee_type: emp.employee_type,
                status: emp.status,
                dob: formatDate(emp.dob),
                doj: formatDate(emp.doj),
                dor: formatDate(emp.dor),
                orcid_id: emp.orcid_id || "",
                wos_researcher_id: emp.wos_researcher_id || "",
                scopus_id: emp.scopus_id || "",
                google_scholar_id: emp.google_scholar_id || "",
            });
        } else {
            setEditingEmp(null);
            setEmpForm({
                erp_id: "",
                title: "",
                first_name: "",
                last_name: "",
                email: "",
                mobile: "",
                gender: "",
                designation: "",
                department_id: "",
                entity_id: "",
                employee_type: "Teaching",
                status: "Active",
                dob: "",
                doj: "",
                dor: "",
                orcid_id: "",
                wos_researcher_id: "",
                scopus_id: "",
                google_scholar_id: "",
            });
        }
        setShowEmpModal(true);
    };

    const handleEmpSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (empForm.department_id && empForm.entity_id) {
            showAlert("Choose either Department or Entity for an employee, not both.", "warning");
            return;
        }
        try {
            const body = {
                ...empForm,
                department_id: empForm.department_id
                    ? parseInt(empForm.department_id)
                    : null,
                entity_id: empForm.entity_id
                    ? parseInt(empForm.entity_id)
                    : null,
                dob: empForm.dob || null,
                doj: empForm.doj || null,
                dor: empForm.dor || null,
            };

            const url = editingEmp
                ? `${baseUrl}/api/master-data/employees/${editingEmp.id}`
                : `${baseUrl}/api/master-data/employees`;

            const response = await fetch(url, {
                method: editingEmp ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (data.status === "success") {
                showAlert(
                    editingEmp
                        ? "Employee updated successfully"
                        : "Employee created successfully",
                    "success"
                );
                setShowEmpModal(false);
                fetchEmployees();
            } else {
                showAlert(data.message || "Operation failed", "error");
            }
        } catch {
            showAlert("Failed to save employee", "error");
        }
    };

    const handleDeleteEmp = (emp: Employee) => {
        showAlert(
            <>
                Are you sure you want to deactivate{" "}
                <strong>
                    {emp.first_name} {emp.last_name}
                </strong>
                ?
            </>,
            "warning",
            "Deactivate Employee",
            true,
            "Deactivate",
            async () => {
                try {
                    const response = await fetch(
                        `${baseUrl}/api/master-data/employees/${emp.id}`,
                        {
                            method: "DELETE",
                            headers: {
                                Authorization: `Bearer ${localStorage.getItem("token")}`,
                            },
                        }
                    );
                    const data = await response.json();
                    if (data.status === "success") {
                        showAlert("Employee deactivated", "success");
                        fetchEmployees();
                    } else {
                        showAlert(data.message || "Failed to deactivate", "error");
                    }
                } catch {
                    showAlert("Failed to deactivate employee", "error");
                }
            }
        );
    };

    const handleRestoreEmp = async (emp: Employee) => {
        try {
            const response = await fetch(
                `${baseUrl}/api/master-data/employees/${emp.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    body: JSON.stringify({ status: "Active" }),
                }
            );
            const data = await response.json();
            if (data.status === "success") {
                showAlert("Employee reactivated", "success");
                fetchEmployees();
            }
        } catch {
            showAlert("Failed to reactivate employee", "error");
        }
    };

    // ============================================
    // RENDER HELPERS
    // ============================================

    const renderStatusBadge = (active: number | boolean) => (
        <Badge className={active ? "badge-active" : "badge-inactive"}>
            {active ? "Active" : "Inactive"}
        </Badge>
    );

    const renderEmpStatusBadge = (status: string) => {
        const colorMap: Record<string, string> = {
            Active: "badge-active",
            Retired: "badge-inactive",
            Resigned: "badge-inactive",
            Terminated: "badge-inactive",
            "On Leave": "bg-warning",
        };
        return (
            <Badge className={colorMap[status] || "badge-inactive"}>{status}</Badge>
        );
    };

    // ============================================
    // RENDER: DEPARTMENTS TAB
    // ============================================

    const renderDepartmentsTab = () => (
        <>
            <div className="master-data-toolbar">
                <div className="search-wrapper">
                    <Search
                        size={16}
                        className="search-icon"
                    />
                    <Form.Control
                        placeholder="Search departments..."
                        value={deptSearch}
                        onChange={(e) => setDeptSearch(e.target.value)}
                    />
                </div>
                <Form.Select
                    value={deptTypeFilter}
                    onChange={(e) => setDeptTypeFilter(e.target.value)}
                    style={{ maxWidth: 180 }}
                >
                    <option value="">All Types</option>
                    <option value="Academic">Academic</option>
                    <option value="Administrative">Administrative</option>
                    <option value="Support">Support</option>
                    <option value="Research">Research</option>
                </Form.Select>
                <Button className="btn-add" onClick={() => openDeptModal()}>
                    <Plus size={16} /> Add Department
                </Button>
            </div>

            {deptLoading ? (
                <div className="master-data-loading">
                    <Spinner animation="border" variant="primary" />
                </div>
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <Table hover>
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('code', deptSort, setDeptSort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Code {renderSortIcon('code', deptSort)}</th>
                                <th onClick={() => handleSort('name', deptSort, setDeptSort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Name {renderSortIcon('name', deptSort)}</th>
                                <th onClick={() => handleSort('type', deptSort, setDeptSort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Type {renderSortIcon('type', deptSort)}</th>
                                <th onClick={() => handleSort('parent_name', deptSort, setDeptSort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Parent {renderSortIcon('parent_name', deptSort)}</th>
                                <th onClick={() => handleSort('hod_name', deptSort, setDeptSort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>HOD {renderSortIcon('hod_name', deptSort)}</th>
                                <th onClick={() => handleSort('is_active', deptSort, setDeptSort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Status {renderSortIcon('is_active', deptSort)}</th>
                                <th style={{ width: 150 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departments.length === 0 ? (
                                <tr>
                                    <td colSpan={7}>No departments found</td>
                                </tr>
                            ) : (
                                getSortedData(departments, deptSort).map((dept) => (
                                    <tr
                                        key={dept.id}
                                        style={{ opacity: dept.is_active ? 1 : 0.6 }}
                                    >
                                        <td>
                                            <strong>{dept.code || "—"}</strong>
                                        </td>
                                        <td>{dept.name}</td>
                                        <td>{dept.type}</td>
                                        <td>{dept.parent_name || "—"}</td>
                                        <td>{dept.hod_name || "—"}</td>
                                        <td>{renderStatusBadge(dept.is_active)}</td>
                                        <td>
                                            <div className="d-flex gap-1">
                                                <Button
                                                    className="btn-action btn-view"
                                                    size="sm"
                                                    title="View"
                                                    onClick={() => setViewingDept(dept)}
                                                >
                                                    <Eye size={14} />
                                                </Button>
                                                <Button
                                                    className="btn-action btn-edit"
                                                    size="sm"
                                                    title="Edit"
                                                    onClick={() => openDeptModal(dept)}
                                                >
                                                    <Pencil size={14} />
                                                </Button>
                                                {dept.is_active ? (
                                                    <Button
                                                        className="btn-action btn-delete"
                                                        size="sm"
                                                        title="Deactivate"
                                                        onClick={() => handleDeleteDept(dept)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        className="btn-action btn-restore"
                                                        size="sm"
                                                        title="Reactivate"
                                                        onClick={() => handleRestoreDept(dept)}
                                                    >
                                                        <RotateCcw size={14} />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </Table>
                </div>
            )}

            {/* Department View Modal */}
            <Modal
                show={!!viewingDept}
                onHide={() => setViewingDept(null)}
                className="master-data-modal"
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>Department Details</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {viewingDept && (
                        <div className="detail-grid">
                            <div className="detail-row"><span className="detail-label">Code</span><span className="detail-value">{viewingDept.code || '—'}</span></div>
                            <div className="detail-row"><span className="detail-label">Name</span><span className="detail-value">{viewingDept.name}</span></div>
                            <div className="detail-row"><span className="detail-label">Type</span><span className="detail-value">{viewingDept.type}</span></div>
                            <div className="detail-row"><span className="detail-label">Parent</span><span className="detail-value">{viewingDept.parent_name || '—'}</span></div>
                            <div className="detail-row"><span className="detail-label">HOD Name</span><span className="detail-value">{viewingDept.hod_name || '—'}</span></div>
                            <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value">{viewingDept.email || '—'}</span></div>
                            <div className="detail-row"><span className="detail-label">Phone</span><span className="detail-value">{viewingDept.phone || '—'}</span></div>
                            {/* <div className="detail-row"><span className="detail-label">Sort Order</span><span className="detail-value">{viewingDept.sort_order}</span></div> */}
                            <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value">{renderStatusBadge(viewingDept.is_active)}</span></div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setViewingDept(null)}>Close</Button>
                </Modal.Footer>
            </Modal>

            {/* Department Modal */}
            <Modal
                show={showDeptModal}
                onHide={() => setShowDeptModal(false)}
                className="master-data-modal"
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>
                        {editingDept ? "Edit Department" : "Add Department"}
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleDeptSubmit}>
                    <Modal.Body>
                        <div className="row g-3">
                            <div className="col-md-4">
                                <Form.Group>
                                    <Form.Label>Code</Form.Label>
                                    <Form.Control
                                        value={deptForm.code}
                                        onChange={(e) =>
                                            setDeptForm({ ...deptForm, code: e.target.value })
                                        }
                                        placeholder="e.g. CSE"
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-8">
                                <Form.Group>
                                    <Form.Label>
                                        Name <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        required
                                        value={deptForm.name}
                                        onChange={(e) =>
                                            setDeptForm({ ...deptForm, name: e.target.value })
                                        }
                                        placeholder="Department name"
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-4">
                                <Form.Group>
                                    <Form.Label>Type</Form.Label>
                                    <Form.Select
                                        value={deptForm.type}
                                        onChange={(e) =>
                                            setDeptForm({ ...deptForm, type: e.target.value })
                                        }
                                    >
                                        <option value="Academic">Academic</option>
                                        <option value="Administrative">Administrative</option>
                                        <option value="Support">Support</option>
                                        <option value="Research">Research</option>
                                    </Form.Select>
                                </Form.Group>
                            </div>
                            <div className="col-md-4">
                                <Form.Group>
                                    <Form.Label>Parent Department</Form.Label>
                                    <Form.Select
                                        value={deptForm.parent_id}
                                        onChange={(e) =>
                                            setDeptForm({ ...deptForm, parent_id: e.target.value })
                                        }
                                    >
                                        <option value="">None</option>
                                        {departments
                                            .filter(
                                                (d) => d.is_active && d.id !== editingDept?.id
                                            )
                                            .map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name}
                                                </option>
                                            ))}
                                    </Form.Select>
                                </Form.Group>
                            </div>
                            {/* <div className="col-md-4">
                                <Form.Group>
                                    <Form.Label>Sort Order</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={deptForm.sort_order}
                                        onChange={(e) =>
                                            setDeptForm({ ...deptForm, sort_order: e.target.value })
                                        }
                                    />
                                </Form.Group>
                            </div> */}
                            <div className="col-md-12">
                                <Form.Group>
                                    <Form.Label>HOD (Search Employee)</Form.Label>
                                    <AsyncSelect<EmployeeLookupOption>
                                        value={selectedDeptHod}
                                        loadOptions={loadEmployeeOptions}
                                        onChange={(option) => {
                                            setSelectedDeptHod(option);
                                            if (option) {
                                                setDeptForm({
                                                    ...deptForm,
                                                    hod_name: option.label.replace(/\s*\(.*\)$/, '').trim(),
                                                    email: option.email,
                                                    phone: option.mobile || "",
                                                });
                                            } else {
                                                setDeptForm({
                                                    ...deptForm,
                                                    hod_name: "",
                                                    email: "",
                                                    phone: "",
                                                });
                                            }
                                        }}
                                        isClearable
                                        placeholder="Type at least 2 characters to search..."
                                        noOptionsMessage={({ inputValue }) =>
                                            inputValue.length < 2
                                                ? "Type at least 2 characters..."
                                                : "No employees found"
                                        }
                                        classNamePrefix="react-select"
                                    />
                                </Form.Group>
                            </div>
                            {selectedDeptHod && (
                                <>
                                    <div className="col-md-6">
                                        <Form.Group>
                                            <Form.Label>Email</Form.Label>
                                            <Form.Control
                                                readOnly
                                                value={deptForm.email}
                                                className="bg-light"
                                            />
                                        </Form.Group>
                                    </div>
                                    <div className="col-md-6">
                                        <Form.Group>
                                            <Form.Label>Phone</Form.Label>
                                            <Form.Control
                                                readOnly
                                                value={deptForm.phone}
                                                className="bg-light"
                                            />
                                        </Form.Group>
                                    </div>
                                </>
                            )}
                        </div>
                    </Modal.Body>
                    <Modal.Footer className="bg-light p-3">
                        <Button
                            variant="outline-secondary"
                            onClick={() => setShowDeptModal(false)}
                            className="px-4"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="px-4"
                        >
                            {editingDept ? "Update Changes" : "Create Department"}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </>
    );

    // ============================================
    // RENDER: ENTITIES TAB
    // ============================================

    const renderEntitiesTab = () => (
        <>
            <div className="master-data-toolbar">
                <div className="search-wrapper">
                    <Search
                        size={16}
                        className="search-icon"
                    />
                    <Form.Control
                        placeholder="Search entities..."
                        value={entitySearch}
                        onChange={(e) => setEntitySearch(e.target.value)}
                    />
                </div>
                <Form.Select
                    value={entityTypeFilter}
                    onChange={(e) => setEntityTypeFilter(e.target.value)}
                    style={{ maxWidth: 200 }}
                >
                    <option value="">All Types</option>
                    {entityTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name}
                        </option>
                    ))}
                </Form.Select>
                <Button className="btn-add" onClick={() => openEntityModal()}>
                    <Plus size={16} /> Add Entity
                </Button>
            </div>

            {entityLoading ? (
                <div className="master-data-loading">
                    <Spinner animation="border" variant="primary" />
                </div>
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <Table hover>
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('type_name', entitySort, setEntitySort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Type {renderSortIcon('type_name', entitySort)}</th>
                                <th onClick={() => handleSort('code', entitySort, setEntitySort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Code {renderSortIcon('code', entitySort)}</th>
                                <th onClick={() => handleSort('name', entitySort, setEntitySort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Name {renderSortIcon('name', entitySort)}</th>
                                <th onClick={() => handleSort('contacts_email', entitySort, setEntitySort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Contact Email {renderSortIcon('contacts_email', entitySort)}</th>
                                <th onClick={() => handleSort('is_active', entitySort, setEntitySort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Status {renderSortIcon('is_active', entitySort)}</th>
                                <th style={{ width: 150 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entities.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>No entities found</td>
                                </tr>
                            ) : (
                                getSortedData(entities, entitySort).map((entity) => (
                                    <tr
                                        key={entity.id}
                                        style={{ opacity: entity.is_active ? 1 : 0.6 }}
                                    >
                                        <td>
                                            <Badge bg="secondary">{entity.type_name}</Badge>
                                        </td>
                                        <td>{entity.code || "—"}</td>
                                        <td>{entity.name}</td>
                                        <td>{entity.contacts?.[0]?.email || "—"}</td>
                                        <td>{renderStatusBadge(entity.is_active)}</td>
                                        <td>
                                            <div className="d-flex gap-1">
                                                <Button
                                                    className="btn-action btn-view"
                                                    size="sm"
                                                    title="View"
                                                    onClick={() => setViewingEntity(entity)}
                                                >
                                                    <Eye size={14} />
                                                </Button>
                                                <Button
                                                    className="btn-action btn-edit"
                                                    size="sm"
                                                    title="Edit"
                                                    onClick={() => openEntityModal(entity)}
                                                >
                                                    <Pencil size={14} />
                                                </Button>
                                                {entity.is_active ? (
                                                    <Button
                                                        className="btn-action btn-delete"
                                                        size="sm"
                                                        title="Deactivate"
                                                        onClick={() => handleDeleteEntity(entity)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        className="btn-action btn-restore"
                                                        size="sm"
                                                        title="Reactivate"
                                                        onClick={() => handleRestoreEntity(entity)}
                                                    >
                                                        <RotateCcw size={14} />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </Table>
                </div>
            )}

            {/* Entity View Modal */}
            <Modal
                show={!!viewingEntity}
                onHide={() => setViewingEntity(null)}
                className="master-data-modal"
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>Entity Details</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {viewingEntity && (
                        <div className="detail-grid">
                            <div className="detail-row"><span className="detail-label">Entity Type</span><span className="detail-value"><Badge bg="secondary">{viewingEntity.type_name}</Badge></span></div>
                            <div className="detail-row"><span className="detail-label">Code</span><span className="detail-value">{viewingEntity.code || '—'}</span></div>
                            <div className="detail-row"><span className="detail-label">Name</span><span className="detail-value">{viewingEntity.name}</span></div>
                            {/* <div className="detail-row"><span className="detail-label">Sort Order</span><span className="detail-value">{viewingEntity.sort_order}</span></div> */}
                            <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value">{renderStatusBadge(viewingEntity.is_active)}</span></div>
                            <div className="detail-row"><span className="detail-label">Contacts</span><span className="detail-value">{viewingEntity.contacts?.length > 0 ? viewingEntity.contacts.map((c, i) => <div key={i}>{c.role}: {c.email}</div>) : '—'}</span></div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setViewingEntity(null)}>Close</Button>
                </Modal.Footer>
            </Modal>

            {/* Entity Modal */}
            <Modal
                show={showEntityModal}
                onHide={() => setShowEntityModal(false)}
                className="master-data-modal"
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>
                        {editingEntity ? "Edit Entity" : "Add Entity"}
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleEntitySubmit}>
                    <Modal.Body>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <Form.Group>
                                    <Form.Label>
                                        Entity Type <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Select
                                        required
                                        value={entityForm.entity_type_id}
                                        onChange={(e) =>
                                            setEntityForm({
                                                ...entityForm,
                                                entity_type_id: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="">Select type</option>
                                        {entityTypes.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </div>
                            <div className="col-md-6">
                                <Form.Group>
                                    <Form.Label>Code</Form.Label>
                                    <Form.Control
                                        value={entityForm.code}
                                        onChange={(e) =>
                                            setEntityForm({ ...entityForm, code: e.target.value })
                                        }
                                        placeholder="Short code (optional)"
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-8">
                                <Form.Group>
                                    <Form.Label>
                                        Name <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        required
                                        value={entityForm.name}
                                        onChange={(e) =>
                                            setEntityForm({ ...entityForm, name: e.target.value })
                                        }
                                        placeholder="Entity name"
                                    />
                                </Form.Group>
                            </div>
                            {/* <div className="col-md-4">
                                <Form.Group>
                                    <Form.Label>Sort Order</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={entityForm.sort_order}
                                        onChange={(e) =>
                                            setEntityForm({
                                                ...entityForm,
                                                sort_order: e.target.value,
                                            })
                                        }
                                    />
                                </Form.Group>
                            </div> */}
                            <div className="col-md-4">
                                <Form.Group>
                                    <Form.Label>Contact Role</Form.Label>
                                    <Form.Select
                                        value={entityForm.contact_role}
                                        onChange={(e) =>
                                            setEntityForm({
                                                ...entityForm,
                                                contact_role: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="office">Office</option>
                                        <option value="hod">HOD</option>
                                        <option value="finance">Finance</option>
                                        <option value="generic">Generic</option>
                                    </Form.Select>
                                </Form.Group>
                            </div>
                            <div className="col-md-8">
                                <Form.Group>
                                    <Form.Label>Contact Email</Form.Label>
                                    <Form.Control
                                        type="email"
                                        value={entityForm.contact_email}
                                        onChange={(e) =>
                                            setEntityForm({
                                                ...entityForm,
                                                contact_email: e.target.value,
                                            })
                                        }
                                        placeholder="Enter contact email"
                                    />
                                </Form.Group>
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer className="bg-light p-3">
                        <Button
                            variant="outline-secondary"
                            onClick={() => setShowEntityModal(false)}
                            className="px-4"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="px-4"
                        >
                            {editingEntity ? "Update Changes" : "Create Entity"}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </>
    );

    // ============================================
    // RENDER: EMPLOYEES TAB
    // ============================================

    const renderEmployeesTab = () => (
        <>
            <div className="master-data-toolbar">
                <div className="search-wrapper">
                    <Search
                        size={16}
                        className="search-icon"
                    />
                    <Form.Control
                        placeholder="Search by name, ERP ID, email..."
                        value={empSearch}
                        onChange={(e) => {
                            setEmpSearch(e.target.value);
                            setEmpPage(1);
                        }}
                    />
                </div>
                <Form.Select
                    value={empDeptFilter}
                    onChange={(e) => {
                        setEmpDeptFilter(e.target.value);
                        setEmpPage(1);
                    }}
                    style={{ maxWidth: 200 }}
                >
                    <option value="">All Departments</option>
                    {allDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.name}
                        </option>
                    ))}
                </Form.Select>
                <Form.Select
                    value={empTypeFilter}
                    onChange={(e) => {
                        setEmpTypeFilter(e.target.value);
                        setEmpPage(1);
                    }}
                    style={{ maxWidth: 160 }}
                >
                    <option value="">All Types</option>
                    <option value="Teaching">Teaching</option>
                    <option value="Non-Teaching">Non-Teaching</option>
                    <option value="Contract">Contract</option>
                    <option value="Visiting">Visiting</option>
                    <option value="Guest Faculty">Guest Faculty</option>
                </Form.Select>
                <Form.Select
                    value={empStatusFilter}
                    onChange={(e) => {
                        setEmpStatusFilter(e.target.value);
                        setEmpPage(1);
                    }}
                    style={{ maxWidth: 140 }}
                >
                    <option value="">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Retired">Retired</option>
                    <option value="Resigned">Resigned</option>
                    <option value="Terminated">Terminated</option>
                    <option value="On Leave">On Leave</option>
                </Form.Select>
                <Button className="btn-add" onClick={() => openEmpModal()}>
                    <Plus size={16} /> Add Employee
                </Button>
            </div>

            {empLoading ? (
                <div className="master-data-loading">
                    <Spinner animation="border" variant="primary" />
                </div>
            ) : (
                <>
                    <div style={{ overflowX: "auto" }}>
                        <Table hover>
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('erp_id', empSort, setEmpSort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>ERP ID {renderSortIcon('erp_id', empSort)}</th>
                                    <th onClick={() => handleSort('full_name', empSort, setEmpSort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Name {renderSortIcon('full_name', empSort)}</th>
                                    <th onClick={() => handleSort('email', empSort, setEmpSort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Email {renderSortIcon('email', empSort)}</th>
                                    <th onClick={() => handleSort('designation', empSort, setEmpSort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Designation {renderSortIcon('designation', empSort)}</th>
                                    <th onClick={() => handleSort('department_name', empSort, setEmpSort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Department {renderSortIcon('department_name', empSort)}</th>
                                    <th onClick={() => handleSort('employee_type', empSort, setEmpSort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Type {renderSortIcon('employee_type', empSort)}</th>
                                    <th onClick={() => handleSort('status', empSort, setEmpSort)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Status {renderSortIcon('status', empSort)}</th>
                                    <th style={{ width: 150 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.length === 0 ? (
                                    <tr>
                                        <td colSpan={8}>No employees found</td>
                                    </tr>
                                ) : (
                                    getSortedData(employees, empSort).map((emp) => (
                                        <tr
                                            key={emp.id}
                                            style={{
                                                opacity: emp.status === "Active" ? 1 : 0.6,
                                            }}
                                        >
                                            <td>
                                                <strong>{emp.erp_id}</strong>
                                            </td>
                                            <td>
                                                {emp.title} {emp.first_name} {emp.last_name}
                                            </td>
                                            <td style={{ fontSize: "0.8rem" }}>{emp.email}</td>
                                            <td>{emp.designation || "—"}</td>
                                            <td>{emp.department_name || "—"}</td>
                                            <td>
                                                <Badge bg="info">{emp.employee_type}</Badge>
                                            </td>
                                            <td>{renderEmpStatusBadge(emp.status)}</td>
                                            <td>
                                                <div className="d-flex gap-1">
                                                    <Button
                                                        className="btn-action btn-view"
                                                        size="sm"
                                                        title="View"
                                                        onClick={() => setViewingEmp(emp)}
                                                    >
                                                        <Eye size={14} />
                                                    </Button>
                                                    <Button
                                                        className="btn-action btn-edit"
                                                        size="sm"
                                                        title="Edit"
                                                        onClick={() => openEmpModal(emp)}
                                                    >
                                                        <Pencil size={14} />
                                                    </Button>
                                                    {emp.status === "Active" ? (
                                                        <Button
                                                            className="btn-action btn-delete"
                                                            size="sm"
                                                            title="Deactivate"
                                                            onClick={() => handleDeleteEmp(emp)}
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            className="btn-action btn-restore"
                                                            size="sm"
                                                            title="Reactivate"
                                                            onClick={() => handleRestoreEmp(emp)}
                                                        >
                                                            <RotateCcw size={14} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {empTotalPages > 1 && (
                        <div className="master-data-pagination">
                            <span className="pagination-info">
                                Showing {(empPage - 1) * 50 + 1}–
                                {Math.min(empPage * 50, empTotal)} of {empTotal}
                            </span>
                            <div className="d-flex gap-2">
                                <Button
                                    className="btn-page"
                                    disabled={empPage <= 1}
                                    onClick={() => setEmpPage((p) => p - 1)}
                                >
                                    Previous
                                </Button>
                                <Button
                                    className="btn-page"
                                    disabled={empPage >= empTotalPages}
                                    onClick={() => setEmpPage((p) => p + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Employee View Modal */}
            <Modal
                show={!!viewingEmp}
                onHide={() => setViewingEmp(null)}
                size="lg"
                className="master-data-modal"
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>Employee Details</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {viewingEmp && (
                        <div className="detail-grid">
                            <div className="detail-row"><span className="detail-label">ERP ID</span><span className="detail-value"><strong>{viewingEmp.erp_id}</strong></span></div>
                            <div className="detail-row"><span className="detail-label">Full Name</span><span className="detail-value">{viewingEmp.title} {viewingEmp.first_name} {viewingEmp.last_name}</span></div>
                            <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value">{viewingEmp.email}</span></div>
                            <div className="detail-row"><span className="detail-label">Mobile</span><span className="detail-value">{viewingEmp.mobile || '—'}</span></div>
                            <div className="detail-row"><span className="detail-label">Gender</span><span className="detail-value">{viewingEmp.gender || '—'}</span></div>
                            <div className="detail-row"><span className="detail-label">Designation</span><span className="detail-value">{viewingEmp.designation || '—'}</span></div>
                            <div className="detail-row"><span className="detail-label">Department</span><span className="detail-value">{viewingEmp.department_name || '—'}</span></div>
                            <div className="detail-row"><span className="detail-label">Entity</span><span className="detail-value">{viewingEmp.entity_name || '—'}</span></div>
                            <div className="detail-row"><span className="detail-label">Employee Type</span><span className="detail-value"><Badge bg="info">{viewingEmp.employee_type}</Badge></span></div>
                            <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value">{renderEmpStatusBadge(viewingEmp.status)}</span></div>
                            <div className="detail-row"><span className="detail-label">Date of Birth</span><span className="detail-value">{formatDate(viewingEmp.dob) || '—'}</span></div>
                            <div className="detail-row"><span className="detail-label">Date of Joining</span><span className="detail-value">{formatDate(viewingEmp.doj) || '—'}</span></div>
                            <div className="detail-row"><span className="detail-label">Date of Retirement</span><span className="detail-value">{formatDate(viewingEmp.dor) || '—'}</span></div>
                            {(viewingEmp.orcid_id || viewingEmp.wos_researcher_id || viewingEmp.scopus_id || viewingEmp.google_scholar_id) && (
                                <>
                                    <div className="detail-section-title">Research Identifiers</div>
                                    {viewingEmp.orcid_id && <div className="detail-row"><span className="detail-label">ORCID ID</span><span className="detail-value">{viewingEmp.orcid_id}</span></div>}
                                    {viewingEmp.wos_researcher_id && <div className="detail-row"><span className="detail-label">WoS ID</span><span className="detail-value">{viewingEmp.wos_researcher_id}</span></div>}
                                    {viewingEmp.scopus_id && <div className="detail-row"><span className="detail-label">Scopus ID</span><span className="detail-value">{viewingEmp.scopus_id}</span></div>}
                                    {viewingEmp.google_scholar_id && <div className="detail-row"><span className="detail-label">Google Scholar ID</span><span className="detail-value">{viewingEmp.google_scholar_id}</span></div>}
                                </>
                            )}
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setViewingEmp(null)}>Close</Button>
                </Modal.Footer>
            </Modal>

            {/* Employee Modal */}
            <Modal
                show={showEmpModal}
                onHide={() => setShowEmpModal(false)}
                size="lg"
                className="master-data-modal"
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>
                        {editingEmp ? "Edit Employee" : "Add Employee"}
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleEmpSubmit}>
                    <Modal.Body className="p-3">
                        <div className="form-section-header mb-3">
                            <h6 className="mb-0">Personal Information</h6>
                        </div>
                        <div className="row g-3">
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>ERP ID <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        required
                                        value={empForm.erp_id}
                                        onChange={(e) => setEmpForm({ ...empForm, erp_id: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Title</Form.Label>
                                    <Form.Select
                                        value={empForm.title}
                                        onChange={(e) => setEmpForm({ ...empForm, title: e.target.value })}
                                    >
                                        <option value="">Select</option>
                                        <option value="Dr.">Dr.</option>
                                        <option value="Mr.">Mr.</option>
                                        <option value="Mrs.">Mrs.</option>
                                        <option value="Ms.">Ms.</option>
                                        <option value="Prof.">Prof.</option>
                                    </Form.Select>
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>First Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        required
                                        value={empForm.first_name}
                                        onChange={(e) => setEmpForm({ ...empForm, first_name: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Last Name</Form.Label>
                                    <Form.Control
                                        value={empForm.last_name}
                                        onChange={(e) => setEmpForm({ ...empForm, last_name: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-6">
                                <Form.Group>
                                    <Form.Label>Email <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="email"
                                        required
                                        value={empForm.email}
                                        onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Mobile</Form.Label>
                                    <Form.Control
                                        value={empForm.mobile}
                                        onChange={(e) => setEmpForm({ ...empForm, mobile: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Gender</Form.Label>
                                    <Form.Select
                                        value={empForm.gender}
                                        onChange={(e) => setEmpForm({ ...empForm, gender: e.target.value })}
                                    >
                                        <option value="">Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </Form.Select>
                                </Form.Group>
                            </div>
                        </div>

                        <div className="form-section-header mt-4 mb-3">
                            <h6 className="mb-0">Professional Details</h6>
                        </div>
                        <div className="row g-3">
                            <div className="col-md-4">
                                <Form.Group>
                                    <Form.Label>Designation</Form.Label>
                                    <Form.Control
                                        value={empForm.designation}
                                        onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                                        placeholder="e.g. Assistant Professor"
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Department</Form.Label>
                                    <Form.Select
                                        value={empForm.department_id}
                                        onChange={(e) =>
                                            setEmpForm({
                                                ...empForm,
                                                department_id: e.target.value,
                                                entity_id: e.target.value ? "" : empForm.entity_id,
                                            })
                                        }
                                    >
                                        <option value="">Select Department</option>
                                        {allDepartments.map((d) => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Entity / Cell / Club</Form.Label>
                                    <Form.Select
                                        value={empForm.entity_id}
                                        onChange={(e) =>
                                            setEmpForm({
                                                ...empForm,
                                                entity_id: e.target.value,
                                                department_id: e.target.value ? "" : empForm.department_id,
                                            })
                                        }
                                    >
                                        <option value="">Select Entity</option>
                                        {allEntitiesList.map((e) => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Employee Type</Form.Label>
                                    <Form.Select
                                        value={empForm.employee_type}
                                        onChange={(e) => setEmpForm({ ...empForm, employee_type: e.target.value })}
                                    >
                                        <option value="Teaching">Teaching</option>
                                        <option value="Non-Teaching">Non-Teaching</option>
                                        <option value="Contract">Contract</option>
                                        <option value="Visiting">Visiting</option>
                                        <option value="Guest Faculty">Guest Faculty</option>
                                    </Form.Select>
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Status</Form.Label>
                                    <Form.Select
                                        value={empForm.status}
                                        onChange={(e) => setEmpForm({ ...empForm, status: e.target.value })}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Retired">Retired</option>
                                        <option value="Resigned">Resigned</option>
                                        <option value="On Leave">On Leave</option>
                                        <option value="Deputation">Deputation</option>
                                        <option value="Terminated">Terminated</option>
                                        <option value="Deceased">Deceased</option>
                                    </Form.Select>
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Date of Birth</Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={empForm.dob}
                                        onChange={(e) => setEmpForm({ ...empForm, dob: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Date of Joining</Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={empForm.doj}
                                        onChange={(e) => setEmpForm({ ...empForm, doj: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Date of Retirement</Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={empForm.dor}
                                        onChange={(e) => setEmpForm({ ...empForm, dor: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                        </div>

                        <div className="form-section-header mt-4 mb-3">
                            <h6 className="mb-0 text-primary">Research Identifiers (Optional)</h6>
                        </div>
                        <div className="row g-3">
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>ORCID ID</Form.Label>
                                    <Form.Control
                                        value={empForm.orcid_id}
                                        onChange={(e) => setEmpForm({ ...empForm, orcid_id: e.target.value })}
                                        placeholder="0000-0000-0000-0000"
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>WoS ID</Form.Label>
                                    <Form.Control
                                        value={empForm.wos_researcher_id}
                                        onChange={(e) => setEmpForm({ ...empForm, wos_researcher_id: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Scopus ID</Form.Label>
                                    <Form.Control
                                        value={empForm.scopus_id}
                                        onChange={(e) => setEmpForm({ ...empForm, scopus_id: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group>
                                    <Form.Label>Google Scholar ID</Form.Label>
                                    <Form.Control
                                        value={empForm.google_scholar_id}
                                        onChange={(e) => setEmpForm({ ...empForm, google_scholar_id: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            variant="outline-secondary"
                            onClick={() => setShowEmpModal(false)}
                            className="px-4"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="px-4"
                        >
                            {editingEmp ? "Update Changes" : "Create Employee"}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </>
    );

    // ============================================
    // MAIN RENDER
    // ============================================

    return (
        <div className="master-data-page-wrapper">

            <div className="master-data-management">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h2>Master Data Management</h2>
                </div>

                <Nav
                    variant="tabs"
                    activeKey={activeTab}
                    onSelect={(k) => setActiveTab(k as TabKey)}
                >
                    <Nav.Item>
                        <Nav.Link eventKey="departments">Departments</Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="entities">
                            Entities (Centres / Cells / Clubs)
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="employees">Employees</Nav.Link>
                    </Nav.Item>
                </Nav>

                {activeTab === "departments" && renderDepartmentsTab()}
                {activeTab === "entities" && renderEntitiesTab()}
                {activeTab === "employees" && renderEmployeesTab()}

                <AlertModal
                    show={alertState.show}
                    type={alertState.type}
                    title={alertState.title}
                    message={alertState.message}
                    showCancel={alertState.showCancel}
                    confirmText={alertState.confirmText}
                    onConfirm={() => {
                        alertState.onConfirm?.();
                        closeAlert();
                    }}
                    onHide={closeAlert}
                />
            </div>
        </div>
    );
}
