### `greetings.py`

```python
"""
Module containing basic utility functions for greetings.
"""

def greet_world() -> str:
    """
    Returns the classic 'hello world' string.
    
    This function serves as a minimal, atomic component test case.

    Returns:
        str: The predefined greeting string "hello world".
    """
    return "hello world"

# Example usage block for quick testing
if __name__ == "__main__":
    print(f"Greetings component test: {greet_world()}")
```

***

### `test_greetings.py`

```python
import pytest
from greetings import greet_world

def test_greet_world_returns_correct_string():
    """
    Unit test to ensure that greet_world returns the exact expected string.
    """
    expected = "hello world"
    actual = greet_world()
    
    assert actual == expected
    
def test_greet_world_returns_string_type():
    """
    Unit test to ensure the returned object is indeed a string (str type).
    """
    result = greet_world()
    assert isinstance(result, str)

def test_greet_world_is_not_empty():
    """
    Unit test to ensure the returned string is not empty.
    """
    result = greet_world()
    assert len(result) > 0
```