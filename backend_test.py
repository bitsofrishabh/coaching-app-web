import requests
import sys
import json
from datetime import datetime
import uuid

class DietTrackerAPITester:
    def __init__(self, base_url="https://pdf-platform-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.test_client_id = None
        self.test_diet_plan_id = None
        self.test_follow_up_id = None
        self.test_transaction_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def log_test_result(self, test_name, success, message=""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if message:
            print(f"    {message}")
        if success:
            self.tests_passed += 1

    def make_request(self, method, endpoint, data=None, expect_status=200):
        """Make HTTP request with proper error handling"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            
            success = response.status_code == expect_status
            if not success:
                print(f"    Status Code: {response.status_code}, Expected: {expect_status}")
                try:
                    error_data = response.json()
                    print(f"    Response: {error_data}")
                except:
                    print(f"    Response Text: {response.text[:500]}")
            return success, response
        
        except requests.exceptions.RequestException as e:
            print(f"    Request failed: {str(e)}")
            return False, None

    def test_api_health(self):
        """Test if API is responding"""
        success, response = self.make_request('GET', '', expect_status=200)
        if success and response:
            data = response.json()
            self.log_test_result("API Health Check", success, f"Message: {data.get('message', '')}")
        else:
            self.log_test_result("API Health Check", False, "API not responding")
        return success

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        test_email = f"testcoach{timestamp}@example.com"
        test_data = {
            "name": f"Test Coach {timestamp}",
            "email": test_email,
            "password": "TestPass123!",
            "role": "coach"
        }
        
        success, response = self.make_request('POST', 'auth/register', test_data, 200)
        if success and response:
            data = response.json()
            self.token = data.get('access_token')
            self.user_id = data.get('user', {}).get('id')
            self.log_test_result("User Registration", True, f"User ID: {self.user_id}")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("User Registration", False, f"Error: {error_msg}")
        return success

    def test_user_login(self):
        """Test user login with existing user"""
        if not self.token:
            self.log_test_result("User Login", False, "No token from registration, cannot test login")
            return False
            
        # Create a second user to test login
        timestamp = datetime.now().strftime("%H%M%S") + "2"
        test_email = f"logintest{timestamp}@example.com"
        register_data = {
            "name": f"Login Test {timestamp}",
            "email": test_email,
            "password": "LoginTest123!",
            "role": "coach"
        }
        
        # Register first
        success, _ = self.make_request('POST', 'auth/register', register_data, 200)
        if not success:
            self.log_test_result("User Login", False, "Failed to create test user for login")
            return False
        
        # Now test login
        login_data = {
            "email": test_email,
            "password": "LoginTest123!"
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data, 200)
        if success and response:
            data = response.json()
            login_token = data.get('access_token')
            self.log_test_result("User Login", True, f"Login successful, got token")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("User Login", False, f"Error: {error_msg}")
        return success

    def test_auth_me(self):
        """Test getting current user info"""
        success, response = self.make_request('GET', 'auth/me', expect_status=200)
        if success and response:
            data = response.json()
            self.log_test_result("Get Current User", True, f"User: {data.get('name')}")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("Get Current User", False, f"Error: {error_msg}")
        return success

    def test_dashboard_stats(self):
        """Test dashboard statistics endpoint"""
        success, response = self.make_request('GET', 'dashboard/stats', expect_status=200)
        if success and response:
            data = response.json()
            self.log_test_result("Dashboard Stats", True, f"Total clients: {data.get('total_clients', 0)}")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("Dashboard Stats", False, f"Error: {error_msg}")
        return success

    def test_create_client(self):
        """Test creating a new client"""
        timestamp = datetime.now().strftime("%H%M%S")
        client_data = {
            "name": f"Test Client {timestamp}",
            "email": f"client{timestamp}@example.com",
            "phone": "+1234567890",
            "age": 30,
            "gender": "male",
            "height_cm": 175.5,
            "initial_weight_kg": 80.0,
            "goal_weight_kg": 75.0,
            "status": "active",
            "notes": "Test client for API testing",
            "program_start_date": "2024-01-01",
            "program_end_date": "2024-06-01"
        }
        
        success, response = self.make_request('POST', 'clients', client_data, 200)
        if success and response:
            data = response.json()
            self.test_client_id = data.get('id')
            self.log_test_result("Create Client", True, f"Client ID: {self.test_client_id}")
        else:
            try:
                error_msg = response.json().get('detail') if response else "No response"
            except:
                error_msg = response.text if response else "No response"
            self.log_test_result("Create Client", False, f"Error: {error_msg}")
        return success

    def test_get_clients(self):
        """Test fetching clients list"""
        success, response = self.make_request('GET', 'clients', expect_status=200)
        if success and response:
            data = response.json()
            client_count = len(data)
            self.log_test_result("Get Clients List", True, f"Found {client_count} clients")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("Get Clients List", False, f"Error: {error_msg}")
        return success

    def test_client_search_filter(self):
        """Test client search and filter functionality"""
        # Test search
        success, response = self.make_request('GET', 'clients?search=Test', expect_status=200)
        search_success = success and response is not None
        
        # Test status filter  
        success2, response2 = self.make_request('GET', 'clients?status=active', expect_status=200)
        filter_success = success2 and response2 is not None
        
        overall_success = search_success and filter_success
        self.log_test_result("Client Search & Filter", overall_success, 
                           f"Search: {'OK' if search_success else 'Failed'}, Filter: {'OK' if filter_success else 'Failed'}")
        return overall_success

    def test_get_client_detail(self):
        """Test getting individual client details"""
        if not self.test_client_id:
            self.log_test_result("Get Client Detail", False, "No test client ID available")
            return False
        
        success, response = self.make_request('GET', f'clients/{self.test_client_id}', expect_status=200)
        if success and response:
            data = response.json()
            self.log_test_result("Get Client Detail", True, f"Client: {data.get('name')}")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("Get Client Detail", False, f"Error: {error_msg}")
        return success

    def test_add_weight_entry(self):
        """Test adding weight entry for client"""
        if not self.test_client_id:
            self.log_test_result("Add Weight Entry", False, "No test client ID available")
            return False
        
        weight_data = {
            "weight_kg": 78.5,
            "recorded_date": "2024-01-15",
            "notes": "Weight check after first week"
        }
        
        success, response = self.make_request('POST', f'clients/{self.test_client_id}/weights', weight_data, 200)
        if success and response:
            data = response.json()
            self.log_test_result("Add Weight Entry", True, f"Weight: {data.get('weight_kg')} kg")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("Add Weight Entry", False, f"Error: {error_msg}")
        return success

    def test_create_diet_plan(self):
        """Test creating a diet plan"""
        if not self.test_client_id:
            self.log_test_result("Create Diet Plan", False, "No test client ID available")
            return False
        
        plan_data = {
            "client_id": self.test_client_id,
            "name": "Weight Loss Plan",
            "description": "Low-calorie diet plan for weight loss",
            "daily_calories": 1500,
            "meals": [
                {
                    "time": "08:00",
                    "name": "Breakfast",
                    "items": [
                        {"name": "Oatmeal", "quantity": "1 cup", "calories": 150}
                    ]
                },
                {
                    "time": "12:00", 
                    "name": "Lunch",
                    "items": [
                        {"name": "Grilled Chicken", "quantity": "150g", "calories": 250}
                    ]
                }
            ],
            "instructions": "Follow strictly and drink plenty of water",
            "is_active": True
        }
        
        success, response = self.make_request('POST', 'diet-plans', plan_data, 200)
        if success and response:
            data = response.json()
            self.test_diet_plan_id = data.get('id')
            self.log_test_result("Create Diet Plan", True, f"Plan ID: {self.test_diet_plan_id}")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("Create Diet Plan", False, f"Error: {error_msg}")
        return success

    def test_get_diet_plans(self):
        """Test fetching diet plans"""
        success, response = self.make_request('GET', 'diet-plans', expect_status=200)
        if success and response:
            data = response.json()
            plan_count = len(data)
            self.log_test_result("Get Diet Plans", True, f"Found {plan_count} diet plans")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("Get Diet Plans", False, f"Error: {error_msg}")
        return success

    def test_create_follow_up(self):
        """Test scheduling a follow-up"""
        if not self.test_client_id:
            self.log_test_result("Create Follow-up", False, "No test client ID available")
            return False
        
        follow_up_data = {
            "client_id": self.test_client_id,
            "scheduled_date": "2024-02-01",
            "type": "check-in",
            "notes": "Weekly progress check"
        }
        
        success, response = self.make_request('POST', 'follow-ups', follow_up_data, 200)
        if success and response:
            data = response.json()
            self.test_follow_up_id = data.get('id')
            self.log_test_result("Create Follow-up", True, f"Follow-up ID: {self.test_follow_up_id}")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("Create Follow-up", False, f"Error: {error_msg}")
        return success

    def test_mark_follow_up_complete(self):
        """Test marking follow-up as complete"""
        if not self.test_follow_up_id:
            self.log_test_result("Mark Follow-up Complete", False, "No test follow-up ID available")
            return False
        
        update_data = {
            "status": "completed",
            "completed_at": datetime.now().isoformat()
        }
        
        success, response = self.make_request('PUT', f'follow-ups/{self.test_follow_up_id}', update_data, 200)
        if success and response:
            data = response.json()
            self.log_test_result("Mark Follow-up Complete", True, f"Status: {data.get('status')}")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("Mark Follow-up Complete", False, f"Error: {error_msg}")
        return success

    def test_get_follow_ups(self):
        """Test fetching follow-ups"""
        success, response = self.make_request('GET', 'follow-ups', expect_status=200)
        if success and response:
            data = response.json()
            follow_up_count = len(data)
            self.log_test_result("Get Follow-ups", True, f"Found {follow_up_count} follow-ups")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("Get Follow-ups", False, f"Error: {error_msg}")
        return success

    def test_create_income_transaction(self):
        """Test creating income transaction"""
        transaction_data = {
            "type": "income",
            "category": "consultation",
            "amount": 150.0,
            "description": "Initial consultation fee",
            "client_id": self.test_client_id,
            "transaction_date": "2024-01-10"
        }
        
        success, response = self.make_request('POST', 'transactions', transaction_data, 200)
        if success and response:
            data = response.json()
            self.test_transaction_id = data.get('id')
            self.log_test_result("Create Income Transaction", True, f"Amount: ₹{data.get('amount')}")
        else:
            try:
                error_msg = response.json().get('detail') if response else "No response"
            except:
                error_msg = response.text if response else "No response"
            self.log_test_result("Create Income Transaction", False, f"Error: {error_msg}")
        return success

    def test_create_expense_transaction(self):
        """Test creating expense transaction"""
        transaction_data = {
            "type": "expense",
            "category": "supplies",
            "amount": 50.0,
            "description": "Office supplies",
            "transaction_date": "2024-01-11"
        }
        
        success, response = self.make_request('POST', 'transactions', transaction_data, 201)
        if success and response:
            data = response.json()
            self.log_test_result("Create Expense Transaction", True, f"Amount: ₹{data.get('amount')}")
        else:
            try:
                error_msg = response.json().get('detail') if response else "No response"
            except:
                error_msg = response.text if response else "No response"
            self.log_test_result("Create Expense Transaction", False, f"Error: {error_msg}")
        return success

    def test_transaction_summary(self):
        """Test getting transaction summary"""
        success, response = self.make_request('GET', 'transactions/summary', expect_status=200)
        if success and response:
            data = response.json()
            self.log_test_result("Transaction Summary", True, 
                               f"Income: ₹{data.get('total_income', 0)}, Expense: ₹{data.get('total_expense', 0)}")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("Transaction Summary", False, f"Error: {error_msg}")
        return success

    def test_get_transactions(self):
        """Test fetching transactions"""
        success, response = self.make_request('GET', 'transactions', expect_status=200)
        if success and response:
            data = response.json()
            transaction_count = len(data)
            self.log_test_result("Get Transactions", True, f"Found {transaction_count} transactions")
        else:
            error_msg = response.json().get('detail') if response else "No response"
            self.log_test_result("Get Transactions", False, f"Error: {error_msg}")
        return success

    def run_all_tests(self):
        """Run comprehensive API testing"""
        print("🚀 Starting DietTracker Pro API Tests")
        print("=" * 50)
        
        # Basic connectivity
        if not self.test_api_health():
            print("❌ API not accessible, stopping tests")
            return False
        
        # Authentication tests
        if not self.test_user_registration():
            print("❌ User registration failed, stopping tests")
            return False
        
        self.test_user_login()
        self.test_auth_me()
        
        # Dashboard and stats
        self.test_dashboard_stats()
        
        # Client management tests
        self.test_create_client()
        self.test_get_clients()
        self.test_client_search_filter()
        self.test_get_client_detail()
        self.test_add_weight_entry()
        
        # Diet plan tests
        self.test_create_diet_plan()
        self.test_get_diet_plans()
        
        # Follow-up tests
        self.test_create_follow_up()
        self.test_get_follow_ups()
        self.test_mark_follow_up_complete()
        
        # Finance tests
        self.test_create_income_transaction()
        self.test_create_expense_transaction()
        self.test_get_transactions()
        self.test_transaction_summary()
        
        # Summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    print("🏥 DietTracker Pro - Backend API Testing")
    tester = DietTrackerAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())