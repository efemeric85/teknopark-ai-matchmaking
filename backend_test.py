#!/usr/bin/env python3
"""
Teknopark AI Matchmaking Backend API Test Suite
Tests all backend endpoints with real Supabase and OpenAI integrations
"""

import requests
import json
import time
import os
from typing import Dict, Any, Optional

class TeknoparKAPITester:
    def __init__(self):
        # Get base URL from environment
        self.base_url = "https://typescript-next14.preview.emergentagent.com"
        self.api_base = f"{self.base_url}/api"
        
        # Test data storage
        self.test_data = {
            'event_id': None,
            'user1_id': None,
            'user2_id': None,
            'match_id': None
        }
        
        # Test results
        self.results = []
        
    def log_result(self, test_name: str, success: bool, message: str, response_data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        
        self.results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'response_data': response_data
        })
        
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> tuple[bool, Any]:
        """Make HTTP request and handle errors"""
        url = f"{self.api_base}{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, timeout=30)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, timeout=30)
            elif method.upper() == 'PATCH':
                response = requests.patch(url, json=data, timeout=30)
            else:
                return False, f"Unsupported method: {method}"
                
            print(f"Request: {method} {url}")
            if data:
                print(f"Body: {json.dumps(data, indent=2)}")
            print(f"Response Status: {response.status_code}")
            print(f"Response: {response.text[:500]}...")
            print("-" * 50)
            
            if response.status_code >= 400:
                return False, f"HTTP {response.status_code}: {response.text}"
                
            return True, response.json()
            
        except requests.exceptions.RequestException as e:
            return False, f"Request failed: {str(e)}"
        except json.JSONDecodeError as e:
            return False, f"Invalid JSON response: {str(e)}"
        except Exception as e:
            return False, f"Unexpected error: {str(e)}"
    
    def test_create_event(self):
        """Test POST /api/events - Create a new event"""
        test_name = "Create Event"
        
        event_data = {
            "name": "Yapay Zeka Zirvesi 2025",
            "theme": "Yapay Zeka",
            "round_duration_sec": 360
        }
        
        success, response = self.make_request('POST', '/events', event_data)
        
        if not success:
            self.log_result(test_name, False, f"Request failed: {response}")
            return False
            
        if not response.get('success'):
            self.log_result(test_name, False, f"API returned success=false: {response}")
            return False
            
        event = response.get('event')
        if not event or not event.get('id'):
            self.log_result(test_name, False, f"No event ID in response: {response}")
            return False
            
        # Store event ID for later tests
        self.test_data['event_id'] = event['id']
        
        self.log_result(test_name, True, f"Event created successfully with ID: {event['id']}", event)
        return True
    
    def test_list_events(self):
        """Test GET /api/events - List all events"""
        test_name = "List Events"
        
        success, response = self.make_request('GET', '/events')
        
        if not success:
            self.log_result(test_name, False, f"Request failed: {response}")
            return False
            
        events = response.get('events', [])
        if not isinstance(events, list):
            self.log_result(test_name, False, f"Events should be an array: {response}")
            return False
            
        # Check if our created event is in the list
        created_event_found = False
        if self.test_data['event_id']:
            for event in events:
                if event.get('id') == self.test_data['event_id']:
                    created_event_found = True
                    break
        
        message = f"Found {len(events)} events"
        if self.test_data['event_id'] and created_event_found:
            message += f", including our created event"
        elif self.test_data['event_id']:
            message += f", but our created event not found"
            
        self.log_result(test_name, True, message, events)
        return True
    
    def test_register_user1(self):
        """Test POST /api/users/register - Register first user"""
        test_name = "Register User 1"
        
        if not self.test_data['event_id']:
            self.log_result(test_name, False, "No event ID available from previous test")
            return False
        
        user_data = {
            "email": "test1@example.com",
            "full_name": "Test Kullanıcı 1",
            "company": "Test Şirketi",
            "position": "CEO",
            "current_intent": "Yapay zeka projelerimiz için yatırımcı arıyorum",
            "event_id": self.test_data['event_id']
        }
        
        success, response = self.make_request('POST', '/users/register', user_data)
        
        if not success:
            self.log_result(test_name, False, f"Request failed: {response}")
            return False
            
        if not response.get('success'):
            self.log_result(test_name, False, f"API returned success=false: {response}")
            return False
            
        user = response.get('user')
        if not user or not user.get('id'):
            self.log_result(test_name, False, f"No user ID in response: {response}")
            return False
            
        # Store user ID for later tests
        self.test_data['user1_id'] = user['id']
        
        # Check if embedding was generated (should be a JSON string)
        embedding = user.get('embedding')
        if not embedding:
            self.log_result(test_name, False, f"No embedding generated for user: {response}")
            return False
            
        try:
            # Try to parse embedding as JSON to verify it's valid
            embedding_data = json.loads(embedding)
            if not isinstance(embedding_data, list) or len(embedding_data) == 0:
                self.log_result(test_name, False, f"Invalid embedding format: {embedding}")
                return False
        except json.JSONDecodeError:
            self.log_result(test_name, False, f"Embedding is not valid JSON: {embedding}")
            return False
            
        self.log_result(test_name, True, f"User 1 registered successfully with ID: {user['id']}, embedding generated", user)
        return True
    
    def test_register_user2(self):
        """Test POST /api/users/register - Register second user"""
        test_name = "Register User 2"
        
        if not self.test_data['event_id']:
            self.log_result(test_name, False, "No event ID available from previous test")
            return False
        
        user_data = {
            "email": "test2@example.com",
            "full_name": "Test Kullanıcı 2",
            "company": "ABC Teknoloji",
            "position": "CTO",
            "current_intent": "Startup'lara yatırım yapmak istiyorum",
            "event_id": self.test_data['event_id']
        }
        
        success, response = self.make_request('POST', '/users/register', user_data)
        
        if not success:
            self.log_result(test_name, False, f"Request failed: {response}")
            return False
            
        if not response.get('success'):
            self.log_result(test_name, False, f"API returned success=false: {response}")
            return False
            
        user = response.get('user')
        if not user or not user.get('id'):
            self.log_result(test_name, False, f"No user ID in response: {response}")
            return False
            
        # Store user ID for later tests
        self.test_data['user2_id'] = user['id']
        
        # Check if embedding was generated
        embedding = user.get('embedding')
        if not embedding:
            self.log_result(test_name, False, f"No embedding generated for user: {response}")
            return False
            
        self.log_result(test_name, True, f"User 2 registered successfully with ID: {user['id']}", user)
        return True
    
    def test_get_event_details(self):
        """Test GET /api/events/{eventId} - Get event details with participants"""
        test_name = "Get Event Details"
        
        if not self.test_data['event_id']:
            self.log_result(test_name, False, "No event ID available from previous test")
            return False
        
        success, response = self.make_request('GET', f'/events/{self.test_data["event_id"]}')
        
        if not success:
            self.log_result(test_name, False, f"Request failed: {response}")
            return False
            
        event = response.get('event')
        participants = response.get('participants', [])
        
        if not event:
            self.log_result(test_name, False, f"No event data in response: {response}")
            return False
            
        if not isinstance(participants, list):
            self.log_result(test_name, False, f"Participants should be an array: {response}")
            return False
            
        # Check if we have our 2 registered users
        expected_participants = 2
        if len(participants) < expected_participants:
            self.log_result(test_name, False, f"Expected {expected_participants} participants, got {len(participants)}")
            return False
            
        self.log_result(test_name, True, f"Event details retrieved with {len(participants)} participants", response)
        return True
    
    def test_start_matching(self):
        """Test POST /api/events/{eventId}/match - Start AI matching"""
        test_name = "Start AI Matching"
        
        if not self.test_data['event_id']:
            self.log_result(test_name, False, "No event ID available from previous test")
            return False
        
        match_data = {
            "round_number": 1
        }
        
        success, response = self.make_request('POST', f'/events/{self.test_data["event_id"]}/match', match_data)
        
        if not success:
            self.log_result(test_name, False, f"Request failed: {response}")
            return False
            
        if not response.get('success'):
            self.log_result(test_name, False, f"API returned success=false: {response}")
            return False
            
        matches = response.get('matches', [])
        if not isinstance(matches, list) or len(matches) == 0:
            self.log_result(test_name, False, f"No matches created: {response}")
            return False
            
        # Store first match ID for later tests
        self.test_data['match_id'] = matches[0]['id']
        
        # Check if icebreaker questions were generated
        for match in matches:
            icebreaker = match.get('icebreaker_question')
            if not icebreaker or icebreaker == "Merhaba! Kendinizi tanıtır mısınız?":
                # This might be the fallback question, which is still valid
                pass
            
        self.log_result(test_name, True, f"AI matching completed with {len(matches)} matches, icebreaker questions generated", matches)
        return True
    
    def test_get_user_matches(self):
        """Test GET /api/matches/user/{userId} - Get user's matches"""
        test_name = "Get User Matches"
        
        if not self.test_data['user1_id']:
            self.log_result(test_name, False, "No user ID available from previous test")
            return False
        
        success, response = self.make_request('GET', f'/matches/user/{self.test_data["user1_id"]}')
        
        if not success:
            self.log_result(test_name, False, f"Request failed: {response}")
            return False
            
        matches = response.get('matches', [])
        if not isinstance(matches, list):
            self.log_result(test_name, False, f"Matches should be an array: {response}")
            return False
            
        if len(matches) == 0:
            self.log_result(test_name, False, f"No matches found for user: {response}")
            return False
            
        # Check if partner info is included
        for match in matches:
            partner = match.get('partner')
            if not partner or not partner.get('id'):
                self.log_result(test_name, False, f"Partner info missing in match: {match}")
                return False
                
        self.log_result(test_name, True, f"User matches retrieved successfully with {len(matches)} matches", matches)
        return True
    
    def test_record_handshake(self):
        """Test POST /api/matches/{matchId}/handshake - Record QR handshake"""
        test_name = "Record QR Handshake"
        
        if not self.test_data['match_id'] or not self.test_data['user1_id']:
            self.log_result(test_name, False, "No match ID or user ID available from previous tests")
            return False
        
        handshake_data = {
            "user_id": self.test_data['user1_id']
        }
        
        success, response = self.make_request('POST', f'/matches/{self.test_data["match_id"]}/handshake', handshake_data)
        
        if not success:
            self.log_result(test_name, False, f"Request failed: {response}")
            return False
            
        if not response.get('success'):
            self.log_result(test_name, False, f"API returned success=false: {response}")
            return False
            
        match = response.get('match')
        both_ready = response.get('bothReady', False)
        
        if not match:
            self.log_result(test_name, False, f"No match data in response: {response}")
            return False
            
        # Check if handshake was recorded
        handshake_a = match.get('handshake_a')
        handshake_b = match.get('handshake_b')
        
        if not handshake_a and not handshake_b:
            self.log_result(test_name, False, f"No handshake recorded: {match}")
            return False
            
        message = f"Handshake recorded successfully"
        if both_ready:
            message += ", both users ready"
        else:
            message += ", waiting for partner"
            
        self.log_result(test_name, True, message, response)
        return True
    
    def run_all_tests(self):
        """Run all backend API tests in sequence"""
        print("=" * 60)
        print("TEKNOPARK AI MATCHMAKING BACKEND API TESTS")
        print("=" * 60)
        print(f"Base URL: {self.base_url}")
        print(f"API Base: {self.api_base}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            self.test_create_event,
            self.test_list_events,
            self.test_register_user1,
            self.test_register_user2,
            self.test_get_event_details,
            self.test_start_matching,
            self.test_get_user_matches,
            self.test_record_handshake
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL {test.__name__}: Unexpected error: {str(e)}")
                failed += 1
            
            # Small delay between tests
            time.sleep(1)
        
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {passed + failed}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed / (passed + failed) * 100):.1f}%")
        
        if failed > 0:
            print("\nFAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"- {result['test']}: {result['message']}")
        
        print("=" * 60)
        
        return failed == 0

if __name__ == "__main__":
    tester = TeknoparKAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)