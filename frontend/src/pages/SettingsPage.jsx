import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Moon,
  RefreshCw,
  Sun,
  UserPlus,
  Users,
  Shield,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hasAnyRole, normalizeRole, useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";

const STAFF_ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "dietitian", label: "Dietitian" },
];

const formatRoleLabel = (role) =>
  String(role || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const ROLE_BADGE_CLASSNAMES = {
  super_admin: "border-violet-500/30 bg-violet-500/10 text-violet-600",
  admin: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  dietitian: "border-amber-500/30 bg-amber-500/10 text-amber-600",
};

const STATUS_BADGE_CLASSNAMES = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  inactive: "border-muted bg-muted text-muted-foreground",
};

const STAFF_FORM_DEFAULTS = {
  name: "",
  email: "",
  phone: "",
  role: "dietitian",
};

export function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const isSuperAdmin = hasAnyRole(user, ["super_admin"]);

  const [inviteCode, setInviteCode] = useState("");
  const [generating, setGenerating] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [staffMembers, setStaffMembers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [staffForm, setStaffForm] = useState(STAFF_FORM_DEFAULTS);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [updatingStaffId, setUpdatingStaffId] = useState("");
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [savingAssignments, setSavingAssignments] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadInviteCode();
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadStaffMembers();
    loadClients();
  }, [isSuperAdmin]);

  const loadInviteCode = async () => {
    try {
      const res = await api.get("/coach/invite-code");
      setInviteCode(res.data.invite_code || "");
    } catch (_error) {
      setInviteCode("");
    }
  };

  const loadStaffMembers = async () => {
    setLoadingStaff(true);
    try {
      const res = await api.get("/staff");
      setStaffMembers(res.data || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load staff members");
    } finally {
      setLoadingStaff(false);
    }
  };

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const res = await api.get("/clients", { params: { limit: 500 } });
      const sortedClients = [...(res.data || [])].sort((left, right) =>
        String(left.name || "").localeCompare(String(right.name || ""))
      );
      setClients(sortedClients);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load clients");
    } finally {
      setLoadingClients(false);
    }
  };

  const generateCode = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/coach/generate-invite");
      setInviteCode(res.data.invite_code);
      toast.success("New invite code generated");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to generate invite code");
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(inviteCode);
    toast.success("Invite code copied");
  };

  const handleCreateStaff = async (event) => {
    event.preventDefault();
    setCreatingStaff(true);
    try {
      await api.post("/staff", staffForm);
      toast.success("Team member added");
      setStaffForm(STAFF_FORM_DEFAULTS);
      await loadStaffMembers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add team member");
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleUpdateStaff = async (staffId, payload, successMessage) => {
    setUpdatingStaffId(staffId);
    try {
      await api.put(`/staff/${staffId}`, payload);
      toast.success(successMessage);
      await loadStaffMembers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update team member");
    } finally {
      setUpdatingStaffId("");
    }
  };

  const handleDeleteStaff = async (staffMember) => {
    setUpdatingStaffId(staffMember.id);
    try {
      await api.delete(`/staff/${staffMember.id}`);
      toast.success("Team member removed");
      await Promise.all([loadStaffMembers(), loadClients()]);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to remove team member");
    } finally {
      setUpdatingStaffId("");
    }
  };

  const openAssignmentDialog = (staffMember) => {
    setSelectedStaff(staffMember);
    setSelectedClientIds(staffMember.assigned_client_ids || []);
    setClientSearch("");
    setAssignmentDialogOpen(true);
  };

  const toggleClientAssignment = (clientId, checked) => {
    setSelectedClientIds((current) => {
      if (checked) {
        return current.includes(clientId) ? current : [...current, clientId];
      }
      return current.filter((item) => item !== clientId);
    });
  };

  const saveAssignments = async () => {
    if (!selectedStaff) return;
    setSavingAssignments(true);
    try {
      await api.put(`/staff/${selectedStaff.id}/assign-clients`, {
        client_ids: selectedClientIds,
      });
      toast.success("Client assignments updated");
      setAssignmentDialogOpen(false);
      setSelectedStaff(null);
      await Promise.all([loadStaffMembers(), loadClients()]);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update assignments");
    } finally {
      setSavingAssignments(false);
    }
  };

  const filteredClients = clients.filter((client) => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return true;
    return String(client.name || "").toLowerCase().includes(query);
  });

  const isDarkMode = mounted ? theme !== "light" : true;

  return (
    <div className="space-y-7 animate-fade-in" data-testid="settings-page">
      <div className="rounded-[2rem] border border-[#E3E0D8] bg-white/90 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A7BC8]">Workspace</p>
        <h1 className="mt-1 font-['Sora'] text-3xl font-semibold text-[#18115E]">Settings</h1>
        <p className="mt-2 text-[#5F6472]">Manage your account, team access, and workspace preferences.</p>
      </div>

      <Card className="border-[#E3E0D8] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="font-['Sora'] text-[#18115E]">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/20 text-xl font-semibold text-primary">
                {user?.name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-medium">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge
                variant="outline"
                className={`mt-2 border ${ROLE_BADGE_CLASSNAMES[normalizeRole(user?.role)] || "border-border"}`}
              >
                {formatRoleLabel(normalizeRole(user?.role))}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#E3E0D8] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="font-['Sora'] text-[#18115E]">Appearance</CardTitle>
          <CardDescription>Choose how the dashboard looks while you work</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#E3E0D8] bg-[#F8F7F4] px-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="theme-switch" className="text-sm font-medium">
                Theme Mode
              </Label>
              <p className="text-sm text-muted-foreground">Switch between light and dark mode.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${!isDarkMode ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                <Sun className="h-4 w-4" />
                <span>Light</span>
              </div>
              <Switch
                id="theme-switch"
                checked={isDarkMode}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                aria-label="Toggle dark mode"
              />
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${isDarkMode ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                <Moon className="h-4 w-4" />
                <span>Dark</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#E3E0D8] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="font-['Sora'] text-[#18115E]">Client Invite Code</CardTitle>
          <CardDescription>Share this code with clients to connect them to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {inviteCode ? (
              <>
                <div className="flex-1 rounded-2xl bg-[#F8F7F4] p-3 text-center font-mono text-lg tracking-widest">
                  {inviteCode}
                </div>
                <Button variant="outline" className="rounded-2xl bg-white" onClick={copyCode} data-testid="copy-invite-code">
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">No invite code generated yet</p>
            )}
          </div>
          <Button onClick={generateCode} disabled={generating} variant="outline" className="w-full rounded-2xl bg-white" data-testid="generate-invite-code">
            <RefreshCw className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
            {inviteCode ? "Generate New Code" : "Generate Invite Code"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Clients can use this code during registration in the mobile app to link their account to yours.
          </p>
        </CardContent>
      </Card>

      {isSuperAdmin && (
        <>
          <Card className="border-[#E3E0D8] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-['Sora'] text-[#18115E]">
                <UserPlus className="h-5 w-5 text-primary" />
                Add Team Member
              </CardTitle>
              <CardDescription>
                Only invited email addresses can register. Finance access is limited to super admins and admins.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateStaff} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="staff-name">Name</Label>
                  <Input
                    id="staff-name"
                    value={staffForm.name}
                    onChange={(event) => setStaffForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Dietitian name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-email">Email</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    value={staffForm.email}
                    onChange={(event) => setStaffForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="name@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-phone">Mobile Number</Label>
                  <Input
                    id="staff-phone"
                    value={staffForm.phone}
                    onChange={(event) => setStaffForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="+91 98xxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-role">Role</Label>
                  <Select
                    value={staffForm.role}
                    onValueChange={(value) => setStaffForm((current) => ({ ...current, role: value }))}
                  >
                    <SelectTrigger id="staff-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 xl:col-span-4">
                  <Button type="submit" disabled={creatingStaff}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {creatingStaff ? "Adding..." : "Add Team Member"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-[#E3E0D8] bg-white shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 font-['Sora'] text-[#18115E]">
                  <Users className="h-5 w-5 text-primary" />
                  Team Access
                </CardTitle>
                <CardDescription>
                  Manage admin and dietitian access, then assign clients to each team member.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-2xl bg-white" onClick={loadStaffMembers} disabled={loadingStaff}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${loadingStaff ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-3xl border border-[#E3E0D8]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F8F7F4]">
                      <TableHead className="w-[22%]">Team Member</TableHead>
                      <TableHead className="w-[18%]">Contact</TableHead>
                      <TableHead className="w-[18%]">Role</TableHead>
                      <TableHead className="w-[14%]">Status</TableHead>
                      <TableHead className="w-[12%]">Assigned Clients</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffMembers.map((staffMember) => {
                      const normalizedRole = normalizeRole(staffMember.role);
                      const isSelfSuperAdmin =
                        normalizedRole === "super_admin" && staffMember.user_id === user?.id;
                      const isLegacySuperAdmin =
                        normalizedRole === "super_admin" && staffMember.user_id !== user?.id;
                      return (
                        <TableRow key={staffMember.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{staffMember.name}</p>
                              <p className="text-xs text-muted-foreground">{staffMember.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{staffMember.phone || "—"}</p>
                          </TableCell>
                          <TableCell>
                            {isSelfSuperAdmin || isLegacySuperAdmin ? (
                              <Badge variant="outline" className={ROLE_BADGE_CLASSNAMES.super_admin}>
                                <Shield className="mr-1 h-3.5 w-3.5" />
                                Super Admin
                              </Badge>
                            ) : (
                              <Select
                                value={normalizedRole}
                                onValueChange={(value) => handleUpdateStaff(staffMember.id, { role: value }, "Role updated")}
                                disabled={updatingStaffId === staffMember.id}
                              >
                                <SelectTrigger className="h-9 w-[160px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STAFF_ROLE_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={STATUS_BADGE_CLASSNAMES[staffMember.status] || STATUS_BADGE_CLASSNAMES.active}
                            >
                              {formatRoleLabel(staffMember.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{staffMember.assigned_client_count || 0}</p>
                              <p className="text-xs text-muted-foreground">clients</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {isLegacySuperAdmin && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUpdateStaff(staffMember.id, { role: "admin" }, "Team member changed to admin")}
                                    disabled={updatingStaffId === staffMember.id}
                                  >
                                    Make Admin
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUpdateStaff(staffMember.id, { role: "dietitian" }, "Team member changed to dietitian")}
                                    disabled={updatingStaffId === staffMember.id}
                                  >
                                    Make Dietitian
                                  </Button>
                                </>
                              )}
                              {!isSelfSuperAdmin && !isLegacySuperAdmin && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAssignmentDialog(staffMember)}
                                  disabled={updatingStaffId === staffMember.id || staffMember.status !== "active"}
                                >
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Assign
                                </Button>
                              )}
                              {!isSelfSuperAdmin && !isLegacySuperAdmin && staffMember.status === "active" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteStaff(staffMember)}
                                  disabled={updatingStaffId === staffMember.id}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remove
                                </Button>
                              )}
                              {!isSelfSuperAdmin && !isLegacySuperAdmin && staffMember.status !== "active" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUpdateStaff(staffMember.id, { status: "active" }, "Team member reactivated")}
                                  disabled={updatingStaffId === staffMember.id}
                                >
                                  Reactivate
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!loadingStaff && staffMembers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                          No staff members found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className="max-w-3xl overflow-hidden border-0 bg-[#F5F4F0] p-0 shadow-2xl">
          <div className="border-b border-[#E3E0D8] bg-white/90 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="font-['Sora'] text-2xl text-[#18115E]">Assign Clients</DialogTitle>
            <DialogDescription>
              {selectedStaff ? `Choose clients for ${selectedStaff.name}. Clients remain visible to all staff for now.` : "Choose clients."}
            </DialogDescription>
          </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="w-full max-w-sm space-y-2">
                <Label htmlFor="client-search">Search Clients</Label>
                <Input
                  id="client-search"
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder="Search by client name"
                />
              </div>
              <div className="rounded-2xl border border-[#E3E0D8] bg-white px-4 py-3 text-sm">
                Selected: <span className="font-semibold">{selectedClientIds.length}</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-[#E3E0D8] bg-white">
              <ScrollArea className="h-[360px]">
                <div className="divide-y divide-border/50">
                  {filteredClients.map((client) => {
                    const checked = selectedClientIds.includes(client.id);
                    return (
                      <label
                        key={client.id}
                        className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleClientAssignment(client.id, value === true)}
                          />
                          <div className="space-y-1">
                            <p className="font-medium">{client.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {client.primary_coach ? `Currently assigned to ${client.primary_coach}` : "Unassigned"}
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {client.status ? formatRoleLabel(client.status) : "Active"}
                        </div>
                      </label>
                    );
                  })}
                  {!loadingClients && filteredClients.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No clients match this search.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="border-t border-[#E3E0D8] px-6 py-4">
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => setAssignmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-2xl" onClick={saveAssignments} disabled={savingAssignments || !selectedStaff}>
              {savingAssignments ? "Saving..." : "Save Assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
